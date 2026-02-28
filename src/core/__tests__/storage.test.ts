import { describe, expect, test } from "bun:test";
import type { ChallengeRecord } from "../../types";
import { InMemoryChallengeStore, InMemorySeenTxStore } from "../storage/memory.js";

function makeChallengeRecord(overrides?: Partial<ChallengeRecord>): ChallengeRecord {
	return {
		challengeId: crypto.randomUUID(),
		requestId: crypto.randomUUID(),
		clientAgentId: "agent://test",
		resourceId: "photo-42",
		tierId: "single",
		amount: "$0.10",
		amountRaw: 100000n,
		asset: "USDC",
		chainId: 84532,
		destination: `0x${"ab".repeat(20)}` as `0x${string}`,
		state: "PENDING",
		expiresAt: new Date(Date.now() + 900_000),
		createdAt: new Date(),
		...overrides,
	};
}

describe("InMemoryChallengeStore", () => {
	test("create and get", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);
		const retrieved = await store.get(record.challengeId);
		expect(retrieved).not.toBeNull();
		expect(retrieved!.challengeId).toBe(record.challengeId);
	});

	test("get returns null for non-existent", async () => {
		const store = new InMemoryChallengeStore();
		expect(await store.get("nonexistent")).toBeNull();
	});

	test("create rejects duplicate challengeId", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);
		await expect(store.create(record)).rejects.toThrow("already exists");
	});

	test("findActiveByRequestId returns matching record", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);
		const found = await store.findActiveByRequestId(record.requestId);
		expect(found).not.toBeNull();
		expect(found!.challengeId).toBe(record.challengeId);
	});

	test("findActiveByRequestId returns null for unknown requestId", async () => {
		const store = new InMemoryChallengeStore();
		expect(await store.findActiveByRequestId("unknown")).toBeNull();
	});

	test("transition PENDING → PAID succeeds", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);

		const txHash = `0x${"cc".repeat(32)}` as `0x${string}`;
		const result = await store.transition(record.challengeId, "PENDING", "PAID", {
			txHash,
			paidAt: new Date(),
		});
		expect(result).toBe(true);

		const updated = await store.get(record.challengeId);
		expect(updated!.state).toBe("PAID");
		expect(updated!.txHash).toBe(txHash);
	});

	test("transition fails with wrong fromState", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);

		const result = await store.transition(record.challengeId, "PAID", "EXPIRED");
		expect(result).toBe(false);

		const unchanged = await store.get(record.challengeId);
		expect(unchanged!.state).toBe("PENDING");
	});

	test("transition fails for non-existent challenge", async () => {
		const store = new InMemoryChallengeStore();
		const result = await store.transition("nonexistent", "PENDING", "PAID");
		expect(result).toBe(false);
	});

	test("transition PENDING → EXPIRED succeeds", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);

		const result = await store.transition(record.challengeId, "PENDING", "EXPIRED");
		expect(result).toBe(true);

		const updated = await store.get(record.challengeId);
		expect(updated!.state).toBe("EXPIRED");
	});

	test("transition PENDING → CANCELLED succeeds", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);

		const result = await store.transition(record.challengeId, "PENDING", "CANCELLED");
		expect(result).toBe(true);

		const updated = await store.get(record.challengeId);
		expect(updated!.state).toBe("CANCELLED");
	});

	test("transition PAID → PAID with accessGrant succeeds", async () => {
		const store = new InMemoryChallengeStore();
		const record = makeChallengeRecord();
		await store.create(record);

		await store.transition(record.challengeId, "PENDING", "PAID", {
			txHash: `0x${"dd".repeat(32)}` as `0x${string}`,
			paidAt: new Date(),
		});

		const grant = {
			type: "AccessGrant" as const,
			challengeId: record.challengeId,
			requestId: record.requestId,
			accessToken: "jwt-token",
			tokenType: "Bearer" as const,
			expiresAt: new Date().toISOString(),
			resourceEndpoint: "https://example.com/resource",
			resourceId: record.resourceId,
			tierId: record.tierId,
			txHash: `0x${"dd".repeat(32)}` as `0x${string}`,
			explorerUrl: "https://basescan.org/tx/0x",
		};

		const result = await store.transition(record.challengeId, "PAID", "PAID", {
			accessGrant: grant,
		});
		expect(result).toBe(true);

		const updated = await store.get(record.challengeId);
		expect(updated!.accessGrant).toBeDefined();
		expect(updated!.accessGrant!.type).toBe("AccessGrant");
	});
});

describe("InMemorySeenTxStore", () => {
	const txHash = `0x${"aa".repeat(32)}` as `0x${string}`;

	test("get returns null for unknown txHash", async () => {
		const store = new InMemorySeenTxStore();
		expect(await store.get(txHash)).toBeNull();
	});

	test("markUsed stores and returns true", async () => {
		const store = new InMemorySeenTxStore();
		const result = await store.markUsed(txHash, "challenge-1");
		expect(result).toBe(true);
	});

	test("get returns challengeId after markUsed", async () => {
		const store = new InMemorySeenTxStore();
		await store.markUsed(txHash, "challenge-1");
		expect(await store.get(txHash)).toBe("challenge-1");
	});

	test("markUsed returns false for duplicate txHash", async () => {
		const store = new InMemorySeenTxStore();
		await store.markUsed(txHash, "challenge-1");
		const result = await store.markUsed(txHash, "challenge-2");
		expect(result).toBe(false);
	});

	test("different txHashes are independent", async () => {
		const store = new InMemorySeenTxStore();
		const txHash2 = `0x${"bb".repeat(32)}` as `0x${string}`;
		await store.markUsed(txHash, "challenge-1");
		await store.markUsed(txHash2, "challenge-2");
		expect(await store.get(txHash)).toBe("challenge-1");
		expect(await store.get(txHash2)).toBe("challenge-2");
	});
});

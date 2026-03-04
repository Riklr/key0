import { describe, expect, test } from "bun:test";
import { MockPaymentAdapter } from "../mock-adapter.js";

describe("MockPaymentAdapter", () => {
	test("issueChallenge returns a valid challengeId", async () => {
		const adapter = new MockPaymentAdapter();
		const result = await adapter.issueChallenge({
			requestId: "req-1",
			resourceId: "photo-42",
			tierId: "single",
			amount: "$0.10",
			destination: `0x${"ab".repeat(20)}` as `0x${string}`,
			expiresAt: new Date(Date.now() + 900_000),
			metadata: {},
		});

		expect(result.challengeId).toBeTypeOf("string");
		expect(result.challengeId.length).toBeGreaterThan(0);
	});

	test("verifyProof returns verified: true by default", async () => {
		const adapter = new MockPaymentAdapter();
		const result = await adapter.verifyProof({
			challengeId: "ch-1",
			proof: {
				txHash: `0x${"cd".repeat(32)}` as `0x${string}`,
				chainId: 84532,
				amount: "$0.10",
				asset: "USDC",
			},
			expected: {
				destination: `0x${"ab".repeat(20)}` as `0x${string}`,
				amountRaw: 100000n,
				chainId: 84532,
				expiresAt: new Date(Date.now() + 900_000),
			},
		});

		expect(result.verified).toBe(true);
	});

	test("setVerifyResult overrides default", async () => {
		const adapter = new MockPaymentAdapter();
		adapter.setVerifyResult({
			verified: false,
			error: "Wrong recipient",
			errorCode: "WRONG_RECIPIENT",
		});

		const result = await adapter.verifyProof({
			challengeId: "ch-1",
			proof: {
				txHash: `0x${"cd".repeat(32)}` as `0x${string}`,
				chainId: 84532,
				amount: "$0.10",
				asset: "USDC",
			},
			expected: {
				destination: `0x${"ab".repeat(20)}` as `0x${string}`,
				amountRaw: 100000n,
				chainId: 84532,
				expiresAt: new Date(Date.now() + 900_000),
			},
		});

		expect(result.verified).toBe(false);
		expect(result.error).toBe("Wrong recipient");
	});

	test("constructor overrides verifyResult defaults", async () => {
		const adapter = new MockPaymentAdapter({
			verified: false,
			error: "Custom error",
			errorCode: "WRONG_RECIPIENT",
		});
		const result = await adapter.verifyProof({
			challengeId: "ch-1",
			proof: {
				txHash: `0x${"cd".repeat(32)}` as `0x${string}`,
				chainId: 84532,
				amount: "$0.10",
				asset: "USDC",
			},
			expected: {
				destination: `0x${"ab".repeat(20)}` as `0x${string}`,
				amountRaw: 100000n,
				chainId: 84532,
				expiresAt: new Date(Date.now() + 900_000),
			},
		});

		expect(result.verified).toBe(false);
		expect(result.error).toBe("Custom error");
	});
});

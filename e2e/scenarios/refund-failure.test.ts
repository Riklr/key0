/**
 * Refund Failure — verifies REFUND_FAILED state when the refund tx reverts.
 *
 * Uses a separate Docker stack (docker-compose.e2e-refund-fail.yml) that has
 * KEY2A_WALLET_PRIVATE_KEY set to a deterministic empty wallet (0 USDC).
 * The refund cron attempts to send USDC from that empty wallet → tx reverts →
 * record transitions to REFUND_FAILED.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	KEY2A_URL,
	DEFAULT_TIER_ID,
	REFUND_FAIL_KEY2A_URL,
	REFUND_FAIL_REDIS_URL,
	REFUND_POLL_TIMEOUT_MS,
} from "../fixtures/constants.ts";
import { key2aWalletAddress, clientWalletAddress } from "../fixtures/wallets.ts";
import {
	printLogs,
	type StackConfig,
	startDockerStack,
	stopDockerStack,
} from "../helpers/docker-manager.ts";
import {
	readChallengeState,
	setStorageBackend,
	writePaidChallengeRecord,
} from "../helpers/storage-client.ts";
import { waitForChallengeState } from "../helpers/wait.ts";

// Detect storage backend from env var
const usePostgres = process.env.E2E_STORAGE_BACKEND === "postgres";

const STACK_CONFIG: StackConfig = usePostgres
	? {
			composeFile: "docker-compose.e2e-refund-fail-postgres.yml",
			projectName: "key2a-e2e-refund-fail-pg",
		}
	: {
			composeFile: "docker-compose.e2e-refund-fail.yml",
			projectName: "key2a-e2e-refund-fail",
		};

beforeAll(async () => {
	console.log(`[refund-fail] Using storage backend: ${usePostgres ? "postgres" : "redis"}`);
	try {
		startDockerStack(STACK_CONFIG);
	} catch (err) {
		console.error("[refund-fail] Docker stack failed:", err);
		printLogs(STACK_CONFIG);
		throw err;
	}

	// Verify Key2a is reachable
	const healthRes = await fetch(`${REFUND_FAIL_KEY2A_URL}/health`);
	if (!healthRes.ok) {
		throw new Error(`Key2a health check failed: ${healthRes.status}`);
	}
	const health = await healthRes.json();
	console.log("[refund-fail] Key2a health:", health);

	// Configure storage backend for this test's helpers
	// Use refund-fail stack URLs
	setStorageBackend(
		usePostgres ? "postgres" : "redis",
		undefined,
		REFUND_FAIL_KEY2A_URL,
		usePostgres ? undefined : REFUND_FAIL_REDIS_URL,
	);
});

afterAll(async () => {
	stopDockerStack(STACK_CONFIG);

	// Reset storage helpers back to the main e2e stack defaults
	// (baseUrl → KEY2A_URL, redisUrl → null)
	setStorageBackend(usePostgres ? "postgres" : "redis", undefined, KEY2A_URL, null);
});

describe("Refund Failure", () => {
	test(
		"PAID record transitions to REFUND_FAILED when key2a wallet has 0 USDC",
		async () => {
			const challengeId = `e2e-refund-fail-${crypto.randomUUID()}`;
			const clientAddr = clientWalletAddress();
			const key2aAddr = key2aWalletAddress();

			// Write PAID record to the refund-fail stack
			const paidAt = new Date(Date.now() - 10_000);
			await writePaidChallengeRecord({
				challengeId,
				requestId: crypto.randomUUID(),
				clientAgentId: `agent://${clientAddr}`,
				resourceId: "refund-fail-resource",
				tierId: DEFAULT_TIER_ID,
				amount: "$0.10",
				amountRaw: 100_000n,
				destination: key2aAddr,
				fromAddress: clientAddr,
				txHash: `0x${"cd".repeat(32)}` as `0x${string}`,
				paidAt,
			});

			// Poll until cron transitions to REFUND_FAILED
			// (empty wallet → transferWithAuthorization reverts → REFUND_FAILED)
			const finalState = await waitForChallengeState(
				async () => {
					const s = await readChallengeState(challengeId);
					// Accept both REFUND_FAILED and REFUNDED (in case wallet has dust)
					return s === "REFUND_FAILED" || s === "REFUNDED" ? s : null;
				},
				"REFUND_FAILED",
				REFUND_POLL_TIMEOUT_MS,
			);

			// Wallet has 0 USDC → must fail
			expect(finalState).toBe("REFUND_FAILED");
		},
		REFUND_POLL_TIMEOUT_MS + 10_000,
	);
});

import { InMemoryChallengeStore, InMemorySeenTxStore } from "@agentgate/core";

export { InMemoryChallengeStore, InMemorySeenTxStore };

/**
 * Create a pair of in-memory stores for testing.
 * Cleanup interval is disabled by default to avoid timer leaks in tests.
 */
export function createTestStores() {
	return {
		store: new InMemoryChallengeStore({ cleanupIntervalMs: 0 }),
		seenTxStore: new InMemorySeenTxStore(),
	};
}

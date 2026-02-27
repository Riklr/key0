import type { ChallengeRecord, ChallengeState } from "./challenge.js";

export interface IChallengeStore {
	/**
	 * Get a challenge by its challengeId.
	 * Returns null if not found.
	 */
	get(challengeId: string): Promise<ChallengeRecord | null>;

	/**
	 * Find an active (non-expired, state=PENDING) challenge by requestId.
	 * Used for idempotency — same requestId returns the same challenge.
	 * Returns null if no active challenge exists for that requestId.
	 */
	findActiveByRequestId(requestId: string): Promise<ChallengeRecord | null>;

	/**
	 * Store a new challenge record.
	 * Must reject if challengeId already exists (no overwrites).
	 */
	create(record: ChallengeRecord): Promise<void>;

	/**
	 * Atomically update a challenge's state and optional fields.
	 * Must reject if the current state does not match `fromState` (optimistic concurrency).
	 * Returns true if updated, false if state mismatch (someone else transitioned it).
	 */
	transition(
		challengeId: string,
		fromState: ChallengeState,
		toState: ChallengeState,
		updates?: Partial<Pick<ChallengeRecord, "txHash" | "paidAt" | "accessGrant">>,
	): Promise<boolean>;
}

export interface ISeenTxStore {
	/**
	 * Check if a txHash has already been used for any challenge.
	 * Returns the challengeId it was used for, or null.
	 */
	get(txHash: `0x${string}`): Promise<string | null>;

	/**
	 * Mark a txHash as used for a given challengeId.
	 * Must reject if txHash already exists (double-spend guard).
	 * Returns true if stored, false if already existed.
	 */
	markUsed(txHash: `0x${string}`, challengeId: string): Promise<boolean>;
}

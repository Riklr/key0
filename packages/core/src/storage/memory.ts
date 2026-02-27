import type {
  ChallengeRecord,
  ChallengeState,
  IChallengeStore,
  ISeenTxStore,
} from "@agentgate/types";

export class InMemoryChallengeStore implements IChallengeStore {
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly requestIndex = new Map<string, string>(); // requestId → challengeId

  async get(challengeId: string): Promise<ChallengeRecord | null> {
    return this.challenges.get(challengeId) ?? null;
  }

  async findActiveByRequestId(requestId: string): Promise<ChallengeRecord | null> {
    const challengeId = this.requestIndex.get(requestId);
    if (!challengeId) return null;
    const record = this.challenges.get(challengeId);
    if (!record) return null;
    // Return regardless of state — engine decides what to do
    return record;
  }

  async create(record: ChallengeRecord): Promise<void> {
    if (this.challenges.has(record.challengeId)) {
      throw new Error(`Challenge ${record.challengeId} already exists`);
    }
    this.challenges.set(record.challengeId, record);
    this.requestIndex.set(record.requestId, record.challengeId);
  }

  async transition(
    challengeId: string,
    fromState: ChallengeState,
    toState: ChallengeState,
    updates?: Partial<Pick<ChallengeRecord, "txHash" | "paidAt" | "accessGrant">>,
  ): Promise<boolean> {
    const record = this.challenges.get(challengeId);
    if (!record || record.state !== fromState) return false;

    // In-memory is single-threaded in JS — this is inherently atomic
    this.challenges.set(challengeId, {
      ...record,
      state: toState,
      ...updates,
    });
    return true;
  }
}

export class InMemorySeenTxStore implements ISeenTxStore {
  private readonly seen = new Map<`0x${string}`, string>(); // txHash → challengeId

  async get(txHash: `0x${string}`): Promise<string | null> {
    return this.seen.get(txHash) ?? null;
  }

  async markUsed(txHash: `0x${string}`, challengeId: string): Promise<boolean> {
    if (this.seen.has(txHash)) return false;
    this.seen.set(txHash, challengeId);
    return true;
  }
}

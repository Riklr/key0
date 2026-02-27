import type {
	ChallengePayload,
	IPaymentAdapter,
	IssueChallengeParams,
	VerificationResult,
	VerifyProofParams,
} from "@agentgate/types";

/**
 * Mock payment adapter for testing.
 * Supports constructor overrides and runtime mutation via `setVerifyResult()`.
 */
export class MockPaymentAdapter implements IPaymentAdapter {
	readonly protocol = "mock";
	private verifyResult: VerificationResult;

	constructor(defaultResult?: Partial<VerificationResult>) {
		this.verifyResult = {
			verified: true,
			txHash: `0x${"a".repeat(64)}` as `0x${string}`,
			confirmedAmount: 100000n,
			confirmedChainId: 84532,
			confirmedAt: new Date(),
			blockNumber: 1000n,
			...defaultResult,
		};
	}

	async issueChallenge(params: IssueChallengeParams): Promise<ChallengePayload> {
		return {
			challengeId: crypto.randomUUID(),
			protocol: this.protocol,
			raw: {},
			expiresAt: params.expiresAt,
		};
	}

	async verifyProof(_params: VerifyProofParams): Promise<VerificationResult> {
		return this.verifyResult;
	}

	setVerifyResult(result: Partial<VerificationResult>): void {
		this.verifyResult = { ...this.verifyResult, ...result };
	}
}

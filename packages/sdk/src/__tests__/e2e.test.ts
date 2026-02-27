import { describe, expect, test } from "bun:test";
import {
  AgentGateError,
  type A2ATaskSendRequest,
  type ChallengePayload,
  type IPaymentAdapter,
  type IssueChallengeParams,
  type SellerConfig,
  type VerificationResult,
  type VerifyProofParams,
} from "@agentgate/types";
import {
  AccessTokenIssuer,
  ChallengeEngine,
  InMemoryChallengeStore,
  InMemorySeenTxStore,
} from "@agentgate/core";
import { AgentGateRouter } from "../router.js";
import { validateToken } from "../middleware.js";

// ---------------------------------------------------------------------------
// Mock Adapter
// ---------------------------------------------------------------------------
class MockPaymentAdapter implements IPaymentAdapter {
  readonly protocol = "mock";
  private verifyResult: VerificationResult = {
    verified: true,
    txHash: `0x${"a".repeat(64)}` as `0x${string}`,
    confirmedAmount: 100000n,
    confirmedChainId: 84532,
    confirmedAt: new Date(),
    blockNumber: 1000n,
  };

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SECRET = "a-very-long-secret-that-is-at-least-32-characters!";
const WALLET = `0x${"ab".repeat(20)}` as `0x${string}`;

function makeConfig(): SellerConfig {
  return {
    agentName: "E2E Test Agent",
    agentDescription: "E2E test",
    agentUrl: "https://agent.example.com",
    providerName: "Test Provider",
    providerUrl: "https://provider.example.com",
    walletAddress: WALLET,
    network: "testnet",
    products: [
      { tierId: "single", label: "Single Photo", amount: "$0.10", resourceType: "photo" },
      { tierId: "album", label: "Full Album", amount: "$1.00", resourceType: "album" },
    ],
    accessTokenSecret: SECRET,
    challengeTTLSeconds: 900,
    onVerifyResource: async (resourceId: string) => {
      return resourceId !== "nonexistent";
    },
    resourceEndpointTemplate: "https://api.example.com/photos/{resourceId}",
  };
}

function createStack(adapterOverride?: MockPaymentAdapter) {
  const config = makeConfig();
  const adapter = adapterOverride ?? new MockPaymentAdapter();
  const store = new InMemoryChallengeStore();
  const seenTxStore = new InMemorySeenTxStore();
  const tokenIssuer = new AccessTokenIssuer(SECRET);

  const engine = new ChallengeEngine({
    config,
    store,
    seenTxStore,
    adapter,
    tokenIssuer,
  });

  const router = new AgentGateRouter({ engine, config });
  return { router, engine, adapter, store, seenTxStore };
}

function makeA2ARequest(data: Record<string, unknown>): A2ATaskSendRequest {
  return {
    jsonrpc: "2.0",
    id: "rpc-1",
    method: "tasks/send",
    params: {
      id: `task-${crypto.randomUUID()}`,
      message: {
        role: "user",
        parts: [{ type: "data", data, mimeType: "application/json" }],
      },
    },
  };
}

function makeTxHash(): `0x${string}` {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as `0x${string}`;
}

type A2AResult = {
  result: {
    id: string;
    status: {
      state: string;
      message?: { parts: { type: string; data?: Record<string, unknown>; text?: string }[] };
    };
  };
};

function extractData(body: unknown): Record<string, unknown> {
  const result = body as A2AResult;
  return result.result.status.message!.parts[0]!.data!;
}

// ---------------------------------------------------------------------------
// E2E Tests
// ---------------------------------------------------------------------------

describe("E2E: Full AgentGate lifecycle", () => {
  test("1. Agent card → AccessRequest → Challenge → Proof → Grant → Token validation", async () => {
    const { router } = createStack();

    // Get agent card
    const cardResult = await router.handleAgentCard();
    expect(cardResult.status).toBe(200);
    const card = cardResult.body as { name: string; skills: { id: string; pricing?: { tierId: string }[] }[] };
    expect(card.name).toBe("E2E Test Agent");
    expect(card.skills).toHaveLength(2);
    expect(card.skills[0]!.pricing).toHaveLength(2);

    // Request access
    const requestId = crypto.randomUUID();
    const accessResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "AccessRequest",
        requestId,
        resourceId: "photo-42",
        tierId: "single",
        clientAgentId: "agent://e2e-test",
      }),
    );
    expect(accessResult.status).toBe(200);

    const challenge = extractData(accessResult.body);
    expect(challenge["type"]).toBe("X402Challenge");
    expect(challenge["amount"]).toBe("$0.10");
    expect(challenge["chainId"]).toBe(84532);
    expect(challenge["destination"]).toBe(WALLET);

    // Submit proof
    const txHash = makeTxHash();
    const proofResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "PaymentProof",
        challengeId: challenge["challengeId"],
        requestId,
        chainId: 84532,
        txHash,
        amount: "$0.10",
        asset: "USDC",
        fromAgentId: "agent://e2e-test",
      }),
    );
    expect(proofResult.status).toBe(200);

    const grant = extractData(proofResult.body);
    expect(grant["type"]).toBe("AccessGrant");
    expect(grant["tokenType"]).toBe("Bearer");
    expect(grant["txHash"]).toBe(txHash);
    expect(grant["resourceEndpoint"]).toBe("https://api.example.com/photos/photo-42");

    // Validate the access token
    const payload = await validateToken(
      `Bearer ${grant["accessToken"] as string}`,
      { secret: SECRET },
    );
    expect(payload.sub).toBe(requestId);
    expect(payload.resourceId).toBe("photo-42");
    expect(payload.tierId).toBe("single");
    expect(payload.txHash).toBe(txHash);
  });

  test("2. Idempotent access request returns same challenge", async () => {
    const { router } = createStack();
    const requestId = crypto.randomUUID();
    const reqData = {
      type: "AccessRequest",
      requestId,
      resourceId: "photo-42",
      tierId: "single",
      clientAgentId: "agent://e2e-test",
    };

    const r1 = await router.handleA2ATask(makeA2ARequest(reqData));
    const r2 = await router.handleA2ATask(makeA2ARequest(reqData));

    const c1 = extractData(r1.body);
    const c2 = extractData(r2.body);
    expect(c1["challengeId"]).toBe(c2["challengeId"]);
  });

  test("3. Resource not found returns error", async () => {
    const { router } = createStack();
    const result = await router.handleA2ATask(
      makeA2ARequest({
        type: "AccessRequest",
        requestId: crypto.randomUUID(),
        resourceId: "nonexistent",
        tierId: "single",
        clientAgentId: "agent://e2e-test",
      }),
    );
    expect(result.status).toBe(404);
    const body = result.body as A2AResult;
    expect(body.result.status.state).toBe("failed");
  });

  test("4. Double-spend prevention — same txHash rejected for second challenge", async () => {
    const { router } = createStack();
    const txHash = makeTxHash();

    // First challenge + proof
    const req1 = makeA2ARequest({
      type: "AccessRequest",
      requestId: crypto.randomUUID(),
      resourceId: "photo-42",
      tierId: "single",
      clientAgentId: "agent://e2e-test",
    });
    const c1Result = await router.handleA2ATask(req1);
    const c1 = extractData(c1Result.body);

    await router.handleA2ATask(
      makeA2ARequest({
        type: "PaymentProof",
        challengeId: c1["challengeId"],
        requestId: crypto.randomUUID(),
        chainId: 84532,
        txHash,
        amount: "$0.10",
        asset: "USDC",
        fromAgentId: "agent://e2e-test",
      }),
    );

    // Second challenge + same txHash
    const req2 = makeA2ARequest({
      type: "AccessRequest",
      requestId: crypto.randomUUID(),
      resourceId: "photo-42",
      tierId: "single",
      clientAgentId: "agent://e2e-test",
    });
    const c2Result = await router.handleA2ATask(req2);
    const c2 = extractData(c2Result.body);

    const doubleSpend = await router.handleA2ATask(
      makeA2ARequest({
        type: "PaymentProof",
        challengeId: c2["challengeId"],
        requestId: crypto.randomUUID(),
        chainId: 84532,
        txHash, // same txHash!
        amount: "$0.10",
        asset: "USDC",
        fromAgentId: "agent://e2e-test",
      }),
    );
    expect(doubleSpend.status).toBe(409);
  });

  test("5. Invalid txHash format is rejected", async () => {
    const { router } = createStack();

    const accessResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "AccessRequest",
        requestId: crypto.randomUUID(),
        resourceId: "photo-42",
        tierId: "single",
        clientAgentId: "agent://e2e-test",
      }),
    );
    const challenge = extractData(accessResult.body);

    const proofResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "PaymentProof",
        challengeId: challenge["challengeId"],
        requestId: crypto.randomUUID(),
        chainId: 84532,
        txHash: "not-a-valid-hash",
        amount: "$0.10",
        asset: "USDC",
        fromAgentId: "agent://e2e-test",
      }),
    );
    expect(proofResult.status).toBe(400);
  });

  test("6. Adapter verification failure returns error", async () => {
    const adapter = new MockPaymentAdapter();
    adapter.setVerifyResult({
      verified: false,
      error: "Wrong recipient",
      errorCode: "WRONG_RECIPIENT",
    });
    const { router } = createStack(adapter);

    const accessResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "AccessRequest",
        requestId: crypto.randomUUID(),
        resourceId: "photo-42",
        tierId: "single",
        clientAgentId: "agent://e2e-test",
      }),
    );
    const challenge = extractData(accessResult.body);

    const proofResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "PaymentProof",
        challengeId: challenge["challengeId"],
        requestId: crypto.randomUUID(),
        chainId: 84532,
        txHash: makeTxHash(),
        amount: "$0.10",
        asset: "USDC",
        fromAgentId: "agent://e2e-test",
      }),
    );
    expect(proofResult.status).toBe(400);
  });

  test("7. Multiple tiers work correctly", async () => {
    const { router } = createStack();

    // Request album tier
    const accessResult = await router.handleA2ATask(
      makeA2ARequest({
        type: "AccessRequest",
        requestId: crypto.randomUUID(),
        resourceId: "photo-42",
        tierId: "album",
        clientAgentId: "agent://e2e-test",
      }),
    );
    expect(accessResult.status).toBe(200);
    const challenge = extractData(accessResult.body);
    expect(challenge["amount"]).toBe("$1.00");
    expect(challenge["tierId"]).toBe("album");
  });
});

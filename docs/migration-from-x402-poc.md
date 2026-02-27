# Migration Guide: x402-poc to AgentGate SDK

This guide helps you migrate from the raw `x402-poc` scripts to the structured AgentGate monorepo SDK.

## What Changed

The `x402-poc` folder contains standalone scripts that directly interact with the x402 protocol using viem. AgentGate wraps this into a structured SDK with:

- **Challenge engine** managing the full lifecycle (request, challenge, proof, grant)
- **Framework adapters** for Express, Hono, and Fastify
- **A2A protocol** support via JSON-RPC 2.0
- **Double-spend protection** and **idempotency** built in
- **Access tokens** (signed JWTs) for downstream API protection
- **Storage backends** (in-memory for dev, Redis for production)

## Mapping Old Scripts to SDK

| x402-poc Script | AgentGate Equivalent |
|----------------|---------------------|
| `sendMoney.ts` (direct USDC transfer) | Handled internally by buyer agent + facilitator |
| `verifyTransaction.ts` (on-chain verification) | `X402Adapter.verifyProof()` in `@agentgate/x402-adapter` |
| `makePayment.ts` (x402 protocol flow) | Client sends `AccessRequest` + `PaymentProof` via A2A |
| `getBalance.ts` (check USDC balance) | Not part of SDK (use viem directly if needed) |
| Manual Express server with 402 response | `agentGateRouter()` from `@agentgate/sdk/express` |

## Step-by-Step Migration

### 1. Install packages

```bash
bun add @agentgate/sdk @agentgate/x402-adapter
```

### 2. Replace manual server setup

**Before** (x402-poc pattern):
```typescript
// Manual Express server returning 402 with payment details
app.get("/protected", (req, res) => {
  if (!req.headers["x-payment"]) {
    return res.status(402).json({ paymentRequired: true, amount: "0.10", ... });
  }
  // Manually verify payment header...
});
```

**After** (AgentGate SDK):
```typescript
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";
import { X402Adapter } from "@agentgate/x402-adapter";

const adapter = new X402Adapter({ network: "testnet" });

app.use(agentGateRouter({
  config: {
    agentName: "My Agent",
    agentDescription: "My payment-gated API",
    agentUrl: "https://my-agent.example.com",
    providerName: "My Company",
    providerUrl: "https://example.com",
    walletAddress: process.env.WALLET_ADDRESS,
    network: "testnet",
    accessTokenSecret: process.env.SECRET,
    products: [
      { tierId: "basic", label: "Basic", amount: "$0.10", resourceType: "api-call" },
    ],
    onVerifyResource: async (resourceId) => true,
  },
  adapter,
}));

// Protect your existing routes
app.use("/api", validateAccessToken({ secret: process.env.SECRET }));
```

### 3. Replace manual verification

**Before**: Calling `verifyTransaction()` manually after receiving a tx hash.

**After**: The challenge engine calls `X402Adapter.verifyProof()` automatically when a `PaymentProof` is submitted. No manual verification needed.

### 4. Environment variables

| x402-poc | AgentGate |
|----------|-----------|
| `WALLET_A_KEY` | Not needed (buyer-side) |
| `WALLET_B_ADDRESS` | `AGENTGATE_WALLET_ADDRESS` |
| `NETWORK` | `AGENTGATE_NETWORK` |
| (none) | `AGENTGATE_ACCESS_TOKEN_SECRET` |

### 5. Client-side changes

The client now interacts via A2A protocol instead of raw HTTP 402:

1. Fetch agent card: `GET /.well-known/agent.json`
2. Send `AccessRequest` → receive `X402Challenge`
3. Pay on-chain USDC
4. Send `PaymentProof` → receive `AccessGrant` with JWT
5. Use JWT as `Authorization: Bearer <token>` header

See `examples/client-agent/agent.ts` for a complete client implementation.

## Key Differences

- **Protocol**: Raw HTTP 402 headers → A2A JSON-RPC 2.0 messages
- **Authentication**: None → Signed JWTs with configurable TTL
- **Storage**: Stateless → Stateful challenge records (in-memory or Redis)
- **Security**: Manual → Built-in double-spend prevention, idempotency, amount/chain guards
- **Verification**: Manual on-chain checks → Automatic via payment adapter

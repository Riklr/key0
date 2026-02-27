# AgentGate

Payment-gated A2A (Agent-to-Agent) endpoints using the x402 protocol with USDC on Base.

AgentGate lets you monetize any API by adding a payment challenge flow: agents request access, pay via on-chain USDC, and receive a signed JWT to access protected resources.

## Packages

| Package | Description |
|---------|-------------|
| [`@agentgate/types`](./packages/types) | Shared TypeScript types and interfaces |
| [`@agentgate/core`](./packages/core) | Challenge engine, access tokens, storage (memory + Redis) |
| [`@agentgate/x402-adapter`](./packages/x402-adapter) | On-chain USDC payment verification via viem |
| [`@agentgate/sdk`](./packages/sdk) | Framework adapters for Express, Hono, and Fastify |
| [`@agentgate/test-utils`](./packages/test-utils) | Mock adapter and test fixtures |

## Quick Start

```bash
bun add @agentgate/sdk @agentgate/x402-adapter
```

```typescript
import express from "express";
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";
import { X402Adapter } from "@agentgate/x402-adapter";

const app = express();
app.use(express.json());

const adapter = new X402Adapter({ network: "testnet" });

app.use(
  agentGateRouter({
    config: {
      agentName: "My Agent",
      agentDescription: "A payment-gated API",
      agentUrl: "https://my-agent.example.com",
      providerName: "My Company",
      providerUrl: "https://example.com",
      walletAddress: "0xYourWalletAddress",
      network: "testnet",
      accessTokenSecret: "your-secret-at-least-32-characters-long!",
      products: [
        { tierId: "basic", label: "Basic Access", amount: "$0.10", resourceType: "api-call" },
      ],
      onVerifyResource: async (resourceId) => true,
    },
    adapter,
  })
);

// Protect your API routes
app.use("/api", validateAccessToken({ secret: "your-secret-at-least-32-characters-long!" }));

app.get("/api/data/:id", (req, res) => {
  res.json({ id: req.params["id"], data: "premium content" });
});

app.listen(3000);
```

This serves:
- `GET /.well-known/agent.json` - Agent card (A2A discovery)
- `POST /agent` - A2A endpoint (challenge/proof flow)
- `GET /api/data/:id` - Protected resource (requires access token)

## How It Works

1. **Discovery** - Client fetches the agent card at `/.well-known/agent.json`
2. **Access Request** - Client sends an `AccessRequest` with resource ID and tier
3. **Challenge** - Server returns an `X402Challenge` with payment details (amount, destination, chain)
4. **Payment** - Client pays on-chain USDC on Base
5. **Proof** - Client submits a `PaymentProof` with the transaction hash
6. **Verification** - Server verifies the payment on-chain
7. **Grant** - Server returns an `AccessGrant` with a signed JWT
8. **Access** - Client uses the JWT to access the protected resource

## Examples

- [`examples/express-seller`](./examples/express-seller) - Express server with photo gallery
- [`examples/hono-seller`](./examples/hono-seller) - Hono server with same features
- [`examples/client-agent`](./examples/client-agent) - Client-side agent integration

## Development

```bash
bun install
bun run typecheck    # Type-check all packages
bun run lint         # Lint with Biome
bun test --recursive # Run all tests
```

## Documentation

- [TECH.md](./TECH.md) - Detailed technical implementation blueprint
- [SPEC.md](./SPEC.md) - Protocol specification
- [Migration Guide](./docs/migration-from-x402-poc.md) - Migrating from x402-poc

## Networks

| Network | Chain | Chain ID | USDC |
|---------|-------|----------|------|
| Testnet | Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Mainnet | Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

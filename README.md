# AgentGate

Payment-gated A2A (Agent-to-Agent) endpoints using the x402 protocol with USDC on Base.

AgentGate lets you monetize any API by adding a payment challenge flow: agents request access, pay via on-chain USDC, and receive a signed JWT to access protected resources. No complex smart contracts needed — just install, configure, and your API is payment-gated.

## Prerequisites

- [Bun](https://bun.sh) v1.3+ (runtime and package manager)
- A wallet address on Base (testnet or mainnet) to receive USDC payments
- Node.js 18+ (if not using Bun as runtime)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd api-agentic-commerce
bun install
```

### 2. Verify the setup

```bash
bun run typecheck    # Type-check all packages
bun run lint         # Lint with Biome
bun test --recursive # Run all 200+ tests
```

### 3. Run an example

```bash
# Terminal 1: Start the seller (Express)
cd examples/express-seller
cp .env.example .env
# Edit .env with your wallet address and a secret
bun run start

# Terminal 2: Run the client agent
cd examples/client-agent
bun run start
```

The seller starts a server at `http://localhost:3000` that serves:
- `GET /.well-known/agent.json` — Agent card for A2A discovery
- `POST /agent` — A2A endpoint for challenge/proof flow
- `GET /api/photos/:id` — Protected resource (requires access token)

The client agent discovers the seller, requests access, simulates payment, and calls the protected API.

## Packages

| Package | Description |
|---------|-------------|
| [`@agentgate/types`](./packages/types) | Shared TypeScript types, interfaces, and error classes |
| [`@agentgate/core`](./packages/core) | Challenge engine, access tokens, storage (in-memory + Redis) |
| [`@agentgate/x402-adapter`](./packages/x402-adapter) | On-chain USDC payment verification via viem |
| [`@agentgate/sdk`](./packages/sdk) | Framework adapters for Express, Hono, and Fastify |
| [`@agentgate/test-utils`](./packages/test-utils) | Mock adapter and test fixtures (dev only) |

## Adding AgentGate to Your App

### Install

```bash
bun add @agentgate/sdk @agentgate/x402-adapter
```

### Express

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
      walletAddress: "0xYourWalletAddress" as `0x${string}`,
      network: "testnet",
      accessTokenSecret: process.env.AGENTGATE_ACCESS_TOKEN_SECRET!,
      products: [
        {
          tierId: "basic",
          label: "Basic Access",
          amount: "$0.10",
          resourceType: "api-call",
          accessDurationSeconds: 3600,
        },
      ],
      onVerifyResource: async (resourceId) => {
        // Check if the resource exists in your database
        return true;
      },
      onPaymentReceived: async (grant) => {
        console.log(`Payment received for ${grant.resourceId}: ${grant.explorerUrl}`);
      },
    },
    adapter,
  })
);

// Protect your existing API routes with the access token middleware
app.use("/api", validateAccessToken({ secret: process.env.AGENTGATE_ACCESS_TOKEN_SECRET! }));

app.get("/api/data/:id", (req, res) => {
  // req.agentGateToken contains decoded JWT claims (resourceId, tierId, txHash)
  res.json({ id: req.params["id"], data: "premium content" });
});

app.listen(3000);
```

### Hono

```typescript
import { Hono } from "hono";
import { agentGateApp, honoValidateAccessToken } from "@agentgate/sdk/hono";
import { X402Adapter } from "@agentgate/x402-adapter";

const adapter = new X402Adapter({ network: "testnet" });
const gate = agentGateApp({ config: { /* same config as above */ }, adapter });

const app = new Hono();
app.route("/", gate);

const api = new Hono();
api.use("/*", honoValidateAccessToken({ secret: process.env.AGENTGATE_ACCESS_TOKEN_SECRET! }));
api.get("/data/:id", (c) => c.json({ data: "premium content" }));
app.route("/api", api);

export default { port: 3000, fetch: app.fetch };
```

### Fastify

```typescript
import Fastify from "fastify";
import { agentGatePlugin, fastifyValidateAccessToken } from "@agentgate/sdk/fastify";
import { X402Adapter } from "@agentgate/x402-adapter";

const fastify = Fastify();
const adapter = new X402Adapter({ network: "testnet" });

await fastify.register(agentGatePlugin, { config: { /* same config */ }, adapter });

// Protect routes
fastify.addHook("onRequest", fastifyValidateAccessToken({
  secret: process.env.AGENTGATE_ACCESS_TOKEN_SECRET!,
}));

fastify.listen({ port: 3000 });
```

## Configuration Reference

### SellerConfig

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `agentName` | `string` | Yes | — | Display name for your agent |
| `agentDescription` | `string` | Yes | — | Description shown in agent card |
| `agentUrl` | `string` | Yes | — | Public URL of your server |
| `providerName` | `string` | Yes | — | Your company/org name |
| `providerUrl` | `string` | Yes | — | Your company/org URL |
| `walletAddress` | `0x${string}` | Yes | — | Wallet address to receive USDC payments |
| `network` | `"testnet" \| "mainnet"` | Yes | — | Base Sepolia (testnet) or Base (mainnet) |
| `products` | `ProductTier[]` | Yes | — | Array of product tiers with pricing |
| `accessTokenSecret` | `string` | Yes | — | Secret for signing JWTs (min 32 chars) |
| `onVerifyResource` | `(resourceId, tierId) => Promise<boolean>` | Yes | — | Callback to verify resource exists |
| `accessTokenTTLSeconds` | `number` | No | `3600` | JWT expiration time |
| `challengeTTLSeconds` | `number` | No | `900` | How long a payment challenge is valid |
| `resourceVerifyTimeoutMs` | `number` | No | `5000` | Timeout for onVerifyResource callback |
| `basePath` | `string` | No | `"/agent"` | A2A endpoint path |
| `resourceEndpointTemplate` | `string` | No | auto | URL template for protected resources (use `{resourceId}`) |
| `onPaymentReceived` | `(grant) => Promise<void>` | No | — | Hook fired after successful payment |
| `onChallengeExpired` | `(challengeId) => Promise<void>` | No | — | Hook fired when a challenge expires |
| `version` | `string` | No | `"1.0.0"` | Agent card version |

### ProductTier

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tierId` | `string` | Yes | — | Unique tier identifier |
| `label` | `string` | Yes | — | Display name |
| `amount` | `string` | Yes | — | Price in dollars (e.g., `"$0.10"`, `"$1.00"`) |
| `resourceType` | `string` | Yes | — | Resource category (e.g., `"photo"`, `"api-call"`) |
| `accessDurationSeconds` | `number` | No | — | Token validity per-tier (overrides `accessTokenTTLSeconds`) |

### Environment Variables

```bash
AGENTGATE_NETWORK=testnet                          # "testnet" or "mainnet"
AGENTGATE_WALLET_ADDRESS=0xYourWalletAddress        # Receive-only wallet (no private key needed)
AGENTGATE_ACCESS_TOKEN_SECRET=your-secret-min-32ch  # JWT signing secret
AGENTGATE_RPC_URL=https://sepolia.base.org          # Optional: custom RPC URL
PORT=3000                                           # Server port
```

## How It Works

```
Client Agent                          Seller Server
     |                                      |
     |  1. GET /.well-known/agent.json      |
     |------------------------------------->|
     |  <-- Agent card (skills, pricing)    |
     |                                      |
     |  2. POST /agent (AccessRequest)      |
     |------------------------------------->|
     |  <-- X402Challenge (amount, chain,   |
     |       destination, challengeId)      |
     |                                      |
     |  3. Pay USDC on Base (on-chain)      |
     |----> Blockchain                      |
     |  <-- txHash                          |
     |                                      |
     |  4. POST /agent (PaymentProof)       |
     |------------------------------------->|
     |      Server verifies tx on-chain --> |
     |  <-- AccessGrant (JWT + endpoint)    |
     |                                      |
     |  5. GET /api/resource/:id            |
     |     Authorization: Bearer <JWT>      |
     |------------------------------------->|
     |  <-- Protected content               |
```

1. **Discovery** — Client fetches the agent card at `/.well-known/agent.json` to learn about available products and pricing
2. **Access Request** — Client sends an `AccessRequest` with the resource ID and desired tier
3. **Challenge** — Server returns an `X402Challenge` with payment details (amount, USDC destination, chain ID)
4. **Payment** — Client pays on-chain USDC on Base. The buyer doesn't need to deploy anything — just a standard ERC-20 transfer
5. **Proof** — Client submits a `PaymentProof` with the transaction hash
6. **Verification** — Server verifies the payment on-chain (correct recipient, amount, not expired, not double-spent)
7. **Grant** — Server returns an `AccessGrant` with a signed JWT and the resource endpoint URL
8. **Access** — Client uses the JWT as a Bearer token to access the protected resource

## Storage

By default, AgentGate uses in-memory storage (suitable for development and single-process deployments). For production with multiple processes, use Redis:

```typescript
import { RedisChallengeStore, RedisSeenTxStore } from "@agentgate/core";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

app.use(
  agentGateRouter({
    config: { /* ... */ },
    adapter,
    store: new RedisChallengeStore({ redis, challengeTTLSeconds: 900 }),
    seenTxStore: new RedisSeenTxStore({ redis }),
  })
);
```

Redis storage provides:
- Atomic state transitions via Lua scripts (safe for concurrent requests)
- Automatic TTL-based cleanup
- Double-spend prevention with `SET NX`

Install Redis peer dependency: `bun add ioredis`

## Security

- **Double-spend prevention** — Each transaction hash can only be redeemed once (enforced atomically)
- **Idempotent requests** — Same `requestId` returns the same challenge (safe to retry)
- **On-chain verification** — Payments are verified against the actual blockchain (recipient, amount, timing)
- **Challenge expiry** — Challenges expire after `challengeTTLSeconds` (default 15 minutes)
- **Secret rotation** — `AccessTokenIssuer.verifyWithFallback()` supports rotating secrets with zero downtime
- **Resource verification timeout** — `onVerifyResource` has a configurable timeout (default 5s) to prevent hanging

## Examples

| Example | Framework | Description |
|---------|-----------|-------------|
| [`examples/express-seller`](./examples/express-seller) | Express | Photo gallery agent with two pricing tiers |
| [`examples/hono-seller`](./examples/hono-seller) | Hono | Same features as Express example, using Hono |
| [`examples/client-agent`](./examples/client-agent) | — | Buyer agent demonstrating the full A2A flow |

## Development

```bash
bun install              # Install all workspace dependencies
bun run typecheck        # Type-check all packages (via Turborepo)
bun run lint             # Lint with Biome
bun test --recursive     # Run all 200+ tests
```

### Project Structure

```
packages/
  types/          # Shared TypeScript types (no runtime code)
  core/           # Challenge engine, tokens, storage
  x402-adapter/   # On-chain USDC verification
  sdk/            # Express, Hono, Fastify adapters
  test-utils/     # Mock adapter and fixtures
examples/
  express-seller/ # Express example server
  hono-seller/    # Hono example server
  client-agent/   # Client agent example
```

## Networks

| Network | Chain | Chain ID | USDC Contract |
|---------|-------|----------|---------------|
| Testnet | Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Mainnet | Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Start with `testnet` for development. Switch to `mainnet` when ready for real payments — just change the `network` config field.

## Documentation

- [TECH.md](./TECH.md) — Detailed technical implementation blueprint
- [SPEC.md](./SPEC.md) — Protocol specification

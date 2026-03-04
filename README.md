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
bun run typecheck    # Type-check
bun run lint         # Lint with Biome
bun test             # Run all tests
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
- `POST /a2a/jsonrpc` — A2A JSON-RPC endpoint for challenge/proof flow
- `GET /api/photos/:id` — Protected resource (requires access token)

The client agent discovers the seller, requests access, pays on-chain, and calls the protected API.

## Install

```bash
bun add @agentgate/sdk
```

Optional peer dependencies:
```bash
bun add ioredis          # For Redis-backed storage in production
```

## Adding AgentGate to Your App

### Express

```typescript
import express from "express";
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";
import { X402Adapter, AccessTokenIssuer } from "@agentgate/sdk";

const app = express();
app.use(express.json());

const adapter = new X402Adapter({ network: "testnet" });
const tokenIssuer = new AccessTokenIssuer(process.env.ACCESS_TOKEN_SECRET!);

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
      products: [
        {
          tierId: "basic",
          label: "Basic Access",
          amount: "$0.10",
          resourceType: "api-call",
          accessDurationSeconds: 3600,
        },
      ],
      onVerifyResource: async (resourceId, tierId) => {
        // Check if the resource exists and the tier is valid
        return true;
      },
      onIssueToken: async (params) => {
        const result = await tokenIssuer.sign(
          {
            sub: params.requestId,
            jti: params.challengeId,
            resourceId: params.resourceId,
            tierId: params.tierId,
            txHash: params.txHash,
          },
          params.accessDurationSeconds,
        );
        return { ...result, tokenType: "Bearer" };
      },
      onPaymentReceived: async (grant) => {
        console.log(`Payment received for ${grant.resourceId}: ${grant.explorerUrl}`);
      },
    },
    adapter,
  })
);

// Protect your existing API routes with the access token middleware
app.use("/api", validateAccessToken({ secret: process.env.ACCESS_TOKEN_SECRET! }));

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
import { X402Adapter } from "@agentgate/sdk";

const adapter = new X402Adapter({ network: "testnet" });
const gate = agentGateApp({ config: { /* same config as above */ }, adapter });

const app = new Hono();
app.route("/", gate);

const api = new Hono();
api.use("/*", honoValidateAccessToken({ secret: process.env.ACCESS_TOKEN_SECRET! }));
api.get("/data/:id", (c) => c.json({ data: "premium content" }));
app.route("/api", api);

export default { port: 3000, fetch: app.fetch };
```

### Fastify

```typescript
import Fastify from "fastify";
import { agentGatePlugin, fastifyValidateAccessToken } from "@agentgate/sdk/fastify";
import { X402Adapter } from "@agentgate/sdk";

const fastify = Fastify();
const adapter = new X402Adapter({ network: "testnet" });

await fastify.register(agentGatePlugin, { config: { /* same config */ }, adapter });

fastify.addHook("onRequest", fastifyValidateAccessToken({
  secret: process.env.ACCESS_TOKEN_SECRET!,
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
| `onVerifyResource` | `(resourceId, tierId) => Promise<boolean>` | Yes | — | Callback to verify the resource exists and the tier is valid |
| `onIssueToken` | `(params: IssueTokenParams) => Promise<TokenIssuanceResult>` | Yes | — | Callback to generate the access token after payment is verified |
| `challengeTTLSeconds` | `number` | No | `900` | How long a payment challenge is valid (15 min) |
| `resourceVerifyTimeoutMs` | `number` | No | `5000` | Timeout for `onVerifyResource` callback |
| `basePath` | `string` | No | `"/a2a"` | A2A endpoint path prefix |
| `resourceEndpointTemplate` | `string` | No | auto | URL template for protected resources (use `{resourceId}`) |
| `gasWalletPrivateKey` | `0x${string}` | No | — | Private key for direct on-chain settlement (no facilitator needed) |
| `facilitatorUrl` | `string` | No | CDP default | Override the x402 facilitator URL |
| `onPaymentReceived` | `(grant: AccessGrant) => Promise<void>` | No | — | Hook fired after successful payment (fire-and-forget) |
| `onChallengeExpired` | `(challengeId: string) => Promise<void>` | No | — | Hook fired when a challenge expires |
| `version` | `string` | No | `"1.0.0"` | Agent card version |

### ProductTier

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tierId` | `string` | Yes | — | Unique tier identifier |
| `label` | `string` | Yes | — | Display name |
| `amount` | `string` | Yes | — | Price in dollars (e.g., `"$0.10"`, `"$1.00"`) |
| `resourceType` | `string` | Yes | — | Resource category (e.g., `"photo"`, `"api-call"`) |
| `accessDurationSeconds` | `number` | No | — | Token validity for this tier |

### IssueTokenParams

Passed to the `onIssueToken` callback:

| Field | Type | Description |
|-------|------|-------------|
| `challengeId` | `string` | Unique challenge ID (use as JWT `jti` for replay prevention) |
| `requestId` | `string` | Client's request ID (use as JWT `sub`) |
| `resourceId` | `string` | The purchased resource |
| `tierId` | `string` | The purchased tier |
| `txHash` | `0x${string}` | On-chain transaction hash |
| `accessDurationSeconds` | `number` | How long the token should be valid |
| `clientAgentId` | `string` | Identifier of the paying agent |

### Environment Variables

```bash
AGENTGATE_NETWORK=testnet                          # "testnet" or "mainnet"
AGENTGATE_WALLET_ADDRESS=0xYourWalletAddress        # Receive-only wallet (no private key needed)
ACCESS_TOKEN_SECRET=your-secret-min-32-chars        # JWT signing secret for AccessTokenIssuer
PORT=3000                                           # Server port

# Required for x402 HTTP flow with CDP facilitator (alternative to gas wallet)
CDP_API_KEY_ID=your-cdp-api-key-id
CDP_API_KEY_SECRET=your-cdp-api-key-secret

# Optional: self-contained settlement without a facilitator
AGENTGATE_GAS_WALLET_KEY=0xYourPrivateKey
```

## How It Works

```
Client Agent                          Seller Server
     |                                      |
     |  1. GET /.well-known/agent.json      |
     |------------------------------------->|
     |  <-- Agent card (skills, pricing)    |
     |                                      |
     |  2. POST /a2a/jsonrpc (AccessRequest)|
     |------------------------------------->|
     |  <-- X402Challenge (amount, chain,   |
     |       destination, challengeId)      |
     |                                      |
     |  3. Pay USDC on Base (on-chain)      |
     |----> Blockchain                      |
     |  <-- txHash                          |
     |                                      |
     |  4. POST /a2a/jsonrpc (PaymentProof) |
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
4. **Payment** — Client pays on-chain USDC on Base — a standard ERC-20 transfer, no custom contracts
5. **Proof** — Client submits a `PaymentProof` with the transaction hash
6. **Verification** — Server verifies the payment on-chain (correct recipient, amount, not expired, not double-spent)
7. **Grant** — Server calls `onIssueToken`, returns an `AccessGrant` with the token and resource endpoint URL
8. **Access** — Client uses the token as a Bearer header to access the protected resource

## Storage

By default, AgentGate uses in-memory storage (suitable for development and single-process deployments). For production with multiple processes, use Redis:

```typescript
import { RedisChallengeStore, RedisSeenTxStore } from "@agentgate/sdk";
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

## Security

- **Double-spend prevention** — Each transaction hash can only be redeemed once (enforced atomically)
- **Idempotent requests** — Same `requestId` returns the same challenge (safe to retry)
- **On-chain verification** — Payments are verified against the actual blockchain (recipient, amount, timing)
- **Challenge expiry** — Challenges expire after `challengeTTLSeconds` (default 15 minutes)
- **Secret rotation** — `AccessTokenIssuer.verifyWithFallback()` supports rotating secrets with zero downtime
- **Resource verification timeout** — `onVerifyResource` has a configurable timeout (default 5s) to prevent hanging

## Token Issuance

The `onIssueToken` callback gives you full control over what token is issued after a verified payment. The simplest setup uses the built-in `AccessTokenIssuer`:

```typescript
import { AccessTokenIssuer } from "@agentgate/sdk";

const tokenIssuer = new AccessTokenIssuer(process.env.ACCESS_TOKEN_SECRET!);

// In SellerConfig:
onIssueToken: async (params) => {
  const result = await tokenIssuer.sign(
    {
      sub: params.requestId,
      jti: params.challengeId,      // Required for replay prevention
      resourceId: params.resourceId,
      tierId: params.tierId,
      txHash: params.txHash,
    },
    params.accessDurationSeconds,
  );
  return { ...result, tokenType: "Bearer" };
},
```

You can also issue custom tokens (API keys, opaque tokens, etc.) — return any string as `token`.

### Secret Rotation

For zero-downtime secret rotation:

```typescript
const issuer = new AccessTokenIssuer(process.env.CURRENT_SECRET!);

// During rotation, verify with both old and new secrets:
const decoded = await issuer.verifyWithFallback(token, [
  process.env.PREVIOUS_SECRET!,
]);
```

## Settlement Strategies

### Facilitator Mode (Default)

Payments are settled via the Coinbase CDP facilitator, which executes an EIP-3009 `transferWithAuthorization` on-chain. Requires CDP API credentials:

```bash
CDP_API_KEY_ID=your-key-id
CDP_API_KEY_SECRET=your-key-secret
```

### Gas Wallet Mode

Settle payments directly without an external service. Provide a wallet private key in config:

```typescript
{
  gasWalletPrivateKey: process.env.GAS_WALLET_PRIVATE_KEY as `0x${string}`,
}
```

The gas wallet must hold ETH on Base to pay transaction fees. No CDP credentials needed.

## Customizing the Agent Card

The agent card at `/.well-known/agent.json` is auto-generated from your `SellerConfig`. No manual JSON needed.

Each entry in `products` becomes a pricing option discoverable by clients:

```typescript
products: [
  {
    tierId: "single-photo",
    label: "Single Photo",
    amount: "$0.10",
    resourceType: "photo",
    accessDurationSeconds: 3600,      // 1 hour access
  },
  {
    tierId: "full-album",
    label: "Full Album Access",
    amount: "$1.00",
    resourceType: "album",
    accessDurationSeconds: 86400,     // 24 hour access
  },
],
```

### Customizing Paths

```typescript
{
  basePath: "/api/v1/agent",                    // Default: "/a2a"
  resourceEndpointTemplate: "https://api.myapp.com/v1/resources/{resourceId}",
  version: "2.0.0",
}
```

## Running Examples with Real Payments

The examples use Base Sepolia testnet by default. Testnet USDC is free — no real money involved.

### Prerequisites

1. **Two wallets** — one for the seller (receive-only address), one for the client (private key needed)
2. **Testnet USDC** — Get free testnet USDC from the [Circle Faucet](https://faucet.circle.com/) (select Base Sepolia)

### Configure the Seller

```bash
cd examples/express-seller
cp .env.example .env
```

Edit `.env`:
```bash
AGENTGATE_NETWORK=testnet
AGENTGATE_WALLET_ADDRESS=0xYourSellerWalletAddress
ACCESS_TOKEN_SECRET=change-me-to-a-random-string-at-least-32-chars
PORT=3000
```

### Configure the Client

```bash
cd examples/client-agent
cp .env.example .env
```

Edit `.env`:
```bash
SELLER_URL=http://localhost:3000
WALLET_PRIVATE_KEY=0xYourClientPrivateKey
AGENTGATE_NETWORK=testnet
```

### Run It

```bash
# Terminal 1
cd examples/express-seller && bun run start

# Terminal 2
cd examples/client-agent && bun run start
```

You'll see the transaction on [Base Sepolia Explorer](https://sepolia.basescan.org).

## Production Deployment

### Checklist

**Storage** — Switch to Redis for multi-process deployments:

```typescript
import { RedisChallengeStore, RedisSeenTxStore } from "@agentgate/sdk";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
// pass store and seenTxStore to agentGateRouter(...)
```

**Network** — Switch to mainnet for real USDC:

```typescript
{
  network: "mainnet",     // Base (chain ID 8453)
  walletAddress: "0x...",
}
```

**Resource verification** — Connect `onVerifyResource` to your real database:

```typescript
{
  onVerifyResource: async (resourceId, tierId) => {
    const resource = await db.resources.findById(resourceId);
    return resource !== null && resource.isActive;
  },
  resourceVerifyTimeoutMs: 3000,
}
```

**Lifecycle hooks** — Use `onPaymentReceived` for logging and webhooks:

```typescript
{
  onPaymentReceived: async (grant) => {
    await analytics.track("payment", { resourceId: grant.resourceId, txHash: grant.txHash });
    await webhooks.send("payment.received", grant);
  },
}
```

**HTTPS** — Always use HTTPS for `agentUrl` in production.

### Docker — Drop-in Standalone Server

A pre-built image is published to Docker Hub on every release. No user code required — configure entirely via environment variables.

**Image:** [`agentgate/sdk`](https://hub.docker.com/r/agentgate/sdk)

| Tag | When |
|---|---|
| `latest` | Latest stable release |
| `1.2.3` / `1.2` / `1` | Specific version |
| `canary` | Latest `main` branch build |

**Two required variables:**

| Variable | Description |
|---|---|
| `AGENTGATE_WALLET_ADDRESS` | Your USDC-receiving wallet (`0x...`) |
| `ISSUE_TOKEN_API` | URL AgentGate POSTs to after payment is verified |

**Quick start (published image):**

```bash
docker run \
  -e AGENTGATE_WALLET_ADDRESS=0xYourWallet \
  -e ISSUE_TOKEN_API=https://api.example.com/issue-token \
  -p 3000:3000 \
  agentgate/sdk:latest
```

**With Docker Compose + Redis:**

```bash
cp docker/.env.example docker/.env
# Edit docker/.env: set AGENTGATE_WALLET_ADDRESS and ISSUE_TOKEN_API
docker compose -f docker/docker-compose.yml up
```

**Build from source:**

```bash
docker build -t agentgate .
docker run \
  -e AGENTGATE_WALLET_ADDRESS=0xYourWallet \
  -e ISSUE_TOKEN_API=https://api.example.com/issue-token \
  -p 3000:3000 \
  agentgate
```

**ISSUE_TOKEN_API contract:**

After on-chain payment is verified, AgentGate POSTs to your endpoint:

```json
{
  "requestId": "uuid",
  "challengeId": "uuid",
  "resourceId": "photo-42",
  "tierId": "basic",
  "txHash": "0x...",
  "label": "Basic",
  "amount": "$0.10",
  "resourceType": "api",
  "accessDurationSeconds": 3600
}
```

Any extra fields you add to your `PRODUCTS` tiers are included automatically.

Your endpoint can return any credential shape — the response is passed through to the client:

```json
{ "token": "eyJ...", "expiresAt": "2025-01-01T00:00:00Z", "tokenType": "Bearer" }
```

```json
{ "apiKey": "sk-123", "apiSecret": "secret", "expiresAt": "..." }
```

If the response has a `token` string field it's used directly. Otherwise the full response is JSON-serialized into the `token` field with `tokenType: "custom"`.

Secure the endpoint with `ISSUE_TOKEN_API_SECRET` — AgentGate sends it as `Authorization: Bearer <secret>`.

See [`docker/.env.example`](docker/.env.example) for all available environment variables.

## Architecture: Embedded vs Standalone Service

### Embedded Mode (Default)

AgentGate runs as middleware within your existing application:

```typescript
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";

app.use(agentGateRouter({ config, adapter }));
app.use("/api", validateAccessToken({ secret }));
```

### Standalone Service Mode

AgentGate runs as a separate service that communicates with your backend via HTTP. Use `createRemoteResourceVerifier` and `createRemoteTokenIssuer` to delegate verification and token issuance:

```typescript
// AgentGate Service
import { createRemoteResourceVerifier, createRemoteTokenIssuer } from "@agentgate/sdk";

const config = {
  onVerifyResource: createRemoteResourceVerifier({
    url: "https://api.myapp.com/internal/verify",
    auth: sharedSecretAuth("X-Internal-Auth", process.env.INTERNAL_SECRET!),
  }),
  onIssueToken: createRemoteTokenIssuer({
    url: "https://api.myapp.com/internal/issue-token",
    auth: sharedSecretAuth("X-Internal-Auth", process.env.INTERNAL_SECRET!),
  }),
  // ...
};
```

Your backend validates tokens using the standalone validator:

```typescript
import { validateAgentGateToken } from "@agentgate/sdk";

app.use("/api", async (req, res, next) => {
  const payload = await validateAgentGateToken(req.headers.authorization, {
    secret: process.env.ACCESS_TOKEN_SECRET!,
  });
  req.agentGateToken = payload;
  next();
});
```

### Service-to-Service Authentication

When AgentGate calls your backend, it can authenticate using:

**1. Shared Secret (Simplest)**
```typescript
import { sharedSecretAuth } from "@agentgate/sdk";
auth: sharedSecretAuth("X-Internal-Auth", process.env.INTERNAL_SECRET!)
```

**2. Signed JWT**
```typescript
import { signedJwtAuth } from "@agentgate/sdk";
auth: signedJwtAuth(tokenIssuer, "backend-service")
```

**3. OAuth 2.0 Client Credentials**
```typescript
import { oauthClientCredentialsAuth } from "@agentgate/sdk";
auth: oauthClientCredentialsAuth({
  tokenUrl: "https://auth.example.com/token",
  clientId: process.env.CLIENT_ID!,
  clientSecret: process.env.CLIENT_SECRET!,
  audience: "my-backend-api",
})
```

See `examples/standalone-service/` for a complete implementation.

## Examples

| Example | Description |
|---------|-------------|
| [`examples/express-seller`](./examples/express-seller) | Express photo gallery with two pricing tiers |
| [`examples/hono-seller`](./examples/hono-seller) | Same features using Hono |
| [`examples/standalone-service`](./examples/standalone-service) | AgentGate as a separate service with Redis + gas wallet |
| [`examples/backend-integration`](./examples/backend-integration) | Coordinating AgentGate service + backend API |
| [`examples/client-agent`](./examples/client-agent) | Buyer agent with real on-chain USDC payments |

## Networks

| Network | Chain | Chain ID | USDC Contract |
|---------|-------|----------|---------------|
| Testnet | Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Mainnet | Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Development

```bash
bun install          # Install dependencies
bun run typecheck    # Type-check
bun run lint         # Lint with Biome
bun test             # Run all tests
bun run build        # Compile to ./dist
```

### Project Structure

```
src/
  index.ts             # Main entry point (exports everything)
  factory.ts           # createAgentGate() — wires all layers together
  executor.ts          # AgentGateExecutor — A2A protocol handler
  middleware.ts        # validateToken() — framework-agnostic token validation
  types/               # Protocol types and interfaces
  core/                # Challenge engine, access tokens, storage, agent card
  adapter/             # X402Adapter — on-chain USDC verification via viem
  integrations/        # Express, Hono, Fastify adapters + x402 HTTP middleware
  helpers/             # Auth strategies, remote verifier/issuer helpers
  validator/           # Standalone validateAgentGateToken (no full SDK init needed)
examples/
  express-seller/
  hono-seller/
  standalone-service/
  backend-integration/
  client-agent/
```

## Documentation

- [TECH.md](./TECH.md) — Technical architecture reference
- [SPEC.md](./SPEC.md) — Protocol specification

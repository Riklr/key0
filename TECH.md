# AgentGate — Technical Architecture Reference

**Version**: 0.2
**Date**: 2026-03-04
**Package**: `@agentgate/sdk` (single package, not a monorepo)

---

## Package Structure

```
src/
├── index.ts                    # Main entry — exports everything
├── factory.ts                  # createAgentGate() — wires all layers
├── executor.ts                 # AgentGateExecutor — A2A protocol handler
├── middleware.ts               # validateToken() — framework-agnostic
├── validator/
│   └── index.ts                # validateAgentGateToken() — standalone
├── types/
│   ├── config.ts               # SellerConfig, ProductTier, IssueTokenParams
│   ├── challenge.ts            # AccessRequest, X402Challenge, PaymentProof, AccessGrant, ChallengeRecord
│   ├── adapter.ts              # IPaymentAdapter interface
│   ├── storage.ts              # IChallengeStore, ISeenTxStore interfaces
│   ├── agent-card.ts           # AgentCard, AgentSkill, SkillPricing
│   ├── x402-extension.ts       # x402 v2 types (PaymentRequirements, EIP3009Authorization)
│   └── errors.ts               # AgentGateError, AgentGateErrorCode
├── core/
│   ├── challenge-engine.ts     # State machine + business logic (562 lines)
│   ├── access-token.ts         # AccessTokenIssuer — JWT sign/verify (HS256, RS256)
│   ├── agent-card.ts           # buildAgentCard() — auto-generates from SellerConfig
│   ├── config-validation.ts    # validateSellerConfig()
│   ├── validation.ts           # UUID, txHash, dollar amount validators
│   └── storage/
│       ├── memory.ts           # InMemoryChallengeStore, InMemorySeenTxStore
│       └── redis.ts            # RedisChallengeStore, RedisSeenTxStore (Lua scripts)
├── adapter/
│   ├── adapter.ts              # X402Adapter implements IPaymentAdapter
│   ├── verify-transfer.ts      # verifyTransfer() — on-chain USDC verification
│   ├── usdc.ts                 # parseDollarToUsdcMicro(), USDC_ABI
│   └── chain-config.ts         # CHAIN_CONFIGS (RPC, USDC address, explorer)
├── integrations/
│   ├── express.ts              # agentGateRouter(), validateAccessToken()
│   ├── hono.ts                 # agentGateApp(), honoValidateAccessToken()
│   ├── fastify.ts              # agentGatePlugin(), fastifyValidateAccessToken()
│   └── x402-http-middleware.ts # buildHttpPaymentRequirements(), settleViaFacilitator(), settleViaGasWallet()
└── helpers/
    ├── auth.ts                 # sharedSecretAuth(), signedJwtAuth(), oauthClientCredentialsAuth()
    └── remote.ts               # createRemoteResourceVerifier(), createRemoteTokenIssuer()
```

### Subpath Exports

```json
{
  ".":          "src/index.ts",
  "./express":  "src/integrations/express.ts",
  "./hono":     "src/integrations/hono.ts",
  "./fastify":  "src/integrations/fastify.ts"
}
```

---

## Core Type Conventions

- **Branded hex types**: `0x${string}` for wallet addresses and tx hashes. Prevents passing raw strings where on-chain values are expected.
- **Dollar amounts as strings**: Prices are `"$0.10"` in all user-facing APIs. Conversion to `bigint` (USDC micro-units, 6 decimals) happens only at the adapter boundary via `parseDollarToUsdcMicro()`.
- **Dates**: ISO-8601 strings in all external API types (`AccessRequest`, `X402Challenge`, etc.). Internal engine uses `Date` objects.
- **States**: `ChallengeState = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED"` — strict union, never raw string.

---

## Challenge Engine (`src/core/challenge-engine.ts`)

The `ChallengeEngine` is the heart of AgentGate. It owns the full challenge lifecycle.

### State Machine

```
PENDING ──payment verified──→ PAID
PENDING ──TTL elapsed────────→ EXPIRED
PENDING ──seller cancels─────→ CANCELLED
```

### Key Methods

```typescript
class ChallengeEngine {
  // Phase 1: Client requests access
  async requestAccess(req: AccessRequest): Promise<X402Challenge>

  // Phase 2: Client submits payment proof
  async submitProof(proof: PaymentProof): Promise<AccessGrant>

  // x402 HTTP helpers
  buildX402PaymentRequired(record: ChallengeRecord): X402PaymentRequiredResponse
  buildX402Receipt(record: ChallengeRecord, grant: AccessGrant): X402SettleResponse

  async getChallengeRecord(challengeId: string): Promise<ChallengeRecord | null>
}
```

### `requestAccess` Flow

1. Validate `tierId` against `config.products`.
2. Call `onVerifyResource(resourceId, tierId)` with a `resourceVerifyTimeoutMs` timeout.
3. Query `store.findActiveByRequestId(requestId)` — if found, return existing challenge (idempotency).
4. Convert `amount` string → `amountRaw` bigint via `parseDollarToUsdcMicro()`.
5. Create `ChallengeRecord` in state `PENDING`, store via `store.create()`.
6. Return `X402Challenge` to client.

### `submitProof` Flow

1. Load challenge by `challengeId`. Assert state is `PENDING` and not expired.
2. Assert `proof.chainId === challenge.chainId` (replay guard).
3. Call `adapter.verifyProof()` → on-chain verification (see below).
4. `seenTxStore.markUsed(txHash, challengeId)` — atomic `SET NX`. If returns `false`: double-spend, abort.
5. `store.transition(id, "PENDING", "PAID", { txHash, paidAt })` — atomic CAS. If returns `false`: concurrent race lost, abort.
6. Call `onIssueToken(params)` → `TokenIssuanceResult`.
7. Fire `onPaymentReceived(grant)` as fire-and-forget (`.catch(noop)` — never blocks token issuance).
8. Return `AccessGrant`.

---

## Storage Layer (`src/core/storage/`)

### Interface Contract

```typescript
interface IChallengeStore {
  get(challengeId: string): Promise<ChallengeRecord | null>;
  findActiveByRequestId(requestId: string): Promise<ChallengeRecord | null>;
  create(record: ChallengeRecord): Promise<void>;
  transition(
    challengeId: string,
    fromState: ChallengeState,
    toState: ChallengeState,
    updates?: Partial<Pick<ChallengeRecord, "txHash" | "paidAt" | "accessGrant">>
  ): Promise<boolean>;  // false = fromState didn't match (CAS miss)
}

interface ISeenTxStore {
  get(txHash: `0x${string}`): Promise<string | null>;
  markUsed(txHash: `0x${string}`, challengeId: string): Promise<boolean>; // false = already used
}
```

### In-Memory (`memory.ts`)

- `Map<challengeId, ChallengeRecord>` for the challenge store.
- `transition()` is synchronous compare-and-swap on the map — atomic because JavaScript is single-threaded.
- Automatic cleanup: a `setInterval` removes expired/paid records based on configurable retention periods.
- Test pattern: `new InMemoryChallengeStore({ cleanupIntervalMs: 0 })` + `store.stopCleanup()` to disable background cleanup in tests.

### Redis (`redis.ts`)

Uses `ioredis`. All critical operations use Lua scripts for atomicity:

**`transition` Lua script** (runs on single Redis node, atomic):
```lua
local record = redis.call('GET', KEYS[1])
if not record then return 0 end
local parsed = cjson.decode(record)
if parsed.state ~= ARGV[1] then return 0 end  -- CAS miss
-- merge updates and write back
redis.call('SET', KEYS[1], cjson.encode(merged), 'EX', ttl)
return 1
```

**`markUsed` Lua script**:
```lua
return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
```
`SET NX` — only the first caller sets the key. All subsequent calls return nil → `false`.

### Why This Matters

Without `transition()` CAS, two concurrent `submitProof` calls with the same txHash could both read `PENDING`, both pass verification, both call `onIssueToken`, and issue two tokens for one payment. The CAS ensures exactly one transition wins.

---

## On-Chain Verification (`src/adapter/verify-transfer.ts`)

`verifyTransfer()` uses viem to fetch and decode the transaction. All six checks must pass:

```
1. getTransactionReceipt(txHash) → receipt must exist
2. receipt.status === "success" (not reverted)
3. ERC-20 Transfer event present in receipt.logs
4. Transfer.to === challenge.destination (correct recipient)
5. Transfer.value >= challenge.amountRaw (no underpayment)
6. block.timestamp <= challenge.expiresAt (payment landed before expiry)
```

Chain config is resolved from `CHAIN_CONFIGS`:

```typescript
CHAIN_CONFIGS = {
  testnet: {
    chainId: 84532,  // Base Sepolia
    rpcUrl: "https://sepolia.base.org",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    explorerBaseUrl: "https://sepolia.basescan.org",
  },
  mainnet: {
    chainId: 8453,   // Base
    rpcUrl: "https://mainnet.base.org",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    explorerBaseUrl: "https://basescan.org",
  },
}
```

---

## x402 HTTP Middleware (`src/integrations/x402-http-middleware.ts`)

Handles the standard x402 HTTP 402 flow (distinct from the A2A challenge/proof flow).

### Flow

```
POST /a2a/access (no PAYMENT-SIGNATURE header)
  → 402 with PaymentRequirements (CAIP-2 network, USDC amount, recipient)

POST /a2a/access (with PAYMENT-SIGNATURE header — base64url EIP-3009 auth)
  → settleViaFacilitator() or settleViaGasWallet()
  → 200 AccessGrant
```

### Settlement Strategies

**Facilitator mode** (`settleViaFacilitator`):
- Decodes `PAYMENT-SIGNATURE` header (base64url JSON containing EIP-3009 `transferWithAuthorization` parameters).
- Calls Coinbase CDP facilitator API, which executes `transferWithAuthorization` on-chain.
- Returns `txHash` from facilitator response.
- Requires `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` environment variables.

**Gas wallet mode** (`settleViaGasWallet`):
- Uses `gasWalletPrivateKey` from `SellerConfig`.
- Executes `transferWithAuthorization` directly via viem (no external service).
- Gas wallet must hold ETH on Base to pay transaction fees.
- Lower latency, no external API calls.
- Enabled by setting `gasWalletPrivateKey` in config.

---

## Access Token Issuer (`src/core/access-token.ts`)

```typescript
class AccessTokenIssuer {
  constructor(secretOrConfig: string | AccessTokenIssuerConfig)

  async sign(claims: TokenClaims, ttlSeconds: number): Promise<TokenResult>
  async verify(token: string): Promise<TokenClaims & { iat: number; exp: number }>
  async verifyWithFallback(token: string, fallbackSecrets: string[]): Promise<...>
}

type TokenClaims = {
  sub: string;        // requestId
  jti: string;        // challengeId — replay prevention
  resourceId: string;
  tierId: string;
  txHash: string;
};
```

- **HS256** (default): Shared secret, minimum 32 characters enforced.
- **RS256**: Pass `{ algorithm: "RS256", privateKey, publicKey }` for asymmetric verification. Useful when the token issuer and verifier are separate services.
- **Zero-downtime rotation**: `verifyWithFallback(token, [oldSecret])` accepts tokens signed with either the current or any listed fallback secret.

---

## Agent Card Generator (`src/core/agent-card.ts`)

`buildAgentCard(config: SellerConfig): AgentCard` auto-generates the A2A agent card:

- One `AgentSkill` per `ProductTier` with input/output JSON schemas
- `SkillPricing` array with amount, asset, chainId, walletAddress per tier
- x402 extension URI and description
- Capability flags: streaming=false, pushNotifications=false

No manual JSON authoring needed — update `products` in `SellerConfig` and the card updates automatically.

---

## Factory (`src/factory.ts`)

`createAgentGate()` wires all layers together:

```typescript
type AgentGateConfig = {
  config: SellerConfig;
  adapter: IPaymentAdapter;
  store?: IChallengeStore;       // defaults to InMemoryChallengeStore
  seenTxStore?: ISeenTxStore;    // defaults to InMemorySeenTxStore
};

type AgentGateInstance = {
  requestHandler: DefaultRequestHandler;  // A2A JSON-RPC handler
  agentCard: AgentCard;
  engine: ChallengeEngine;
  executor: AgentGateExecutor;
};

function createAgentGate(opts: AgentGateConfig): AgentGateInstance
```

Framework integration functions (`agentGateRouter`, `agentGateApp`, `agentGatePlugin`) call `createAgentGate()` internally and mount the resulting `requestHandler` on the appropriate routes.

---

## A2A Executor (`src/executor.ts`)

`AgentGateExecutor` implements `@a2a-js/sdk`'s `AgentExecutor` interface and handles three message types:

| Message Type | Action | A2A Task State |
|---|---|---|
| `AccessRequest` | `engine.requestAccess()` | `input-required` + x402 metadata |
| `PaymentProof` | `engine.submitProof()` | `completed` + `AccessGrant` |
| x402 payload in metadata | Converts to `PaymentProof` + `submitProof()` | `completed` + `AccessGrant` |

Errors return a Task with `failed` state and error metadata (`x402.payment.error`, `x402.payment.status`).

---

## Remote Helpers (`src/helpers/remote.ts`)

For standalone service deployments where AgentGate runs separately from the backend:

```typescript
// AgentGate delegates resource verification to backend
const verifier = createRemoteResourceVerifier({
  url: "https://api.myapp.com/internal/verify",
  auth: sharedSecretAuth("X-Internal-Auth", secret),
});

// AgentGate delegates token issuance to backend
const issuer = createRemoteTokenIssuer({
  url: "https://api.myapp.com/internal/issue-token",
  auth: sharedSecretAuth("X-Internal-Auth", secret),
});
```

Auth strategies for service-to-service calls:

| Strategy | Function | Use Case |
|---|---|---|
| Shared secret | `sharedSecretAuth(headerName, secret)` | Simple internal calls |
| Signed JWT | `signedJwtAuth(issuer, audience, ttl?)` | Higher security, short-lived tokens |
| OAuth 2.0 | `oauthClientCredentialsAuth({ tokenUrl, clientId, clientSecret })` | Standard OAuth provider integration |

---

## Error System (`src/types/errors.ts`)

```typescript
class AgentGateError extends Error {
  code: AgentGateErrorCode;
  httpStatus: number;
  details?: Record<string, unknown>;
}
```

| Code | HTTP Status | When |
|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | `onVerifyResource` returns false |
| `TIER_NOT_FOUND` | 400 | tierId not in products |
| `CHALLENGE_NOT_FOUND` | 404 | challengeId unknown |
| `CHALLENGE_EXPIRED` | 410 | challenge TTL elapsed |
| `CHAIN_MISMATCH` | 400 | proof.chainId ≠ challenge.chainId |
| `AMOUNT_MISMATCH` | 400 | transfer value < required |
| `TX_UNCONFIRMED` | 402 | receipt not found yet |
| `TX_ALREADY_REDEEMED` | 409 | txHash already used |
| `PAYMENT_FAILED` | 402 | on-chain verification failed |
| `RESOURCE_VERIFY_TIMEOUT` | 504 | onVerifyResource exceeded timeout |
| `TOKEN_ISSUE_TIMEOUT` | 504 | onIssueToken exceeded timeout |
| `INTERNAL_ERROR` | 500 | unexpected failure |

---

## Security Model

### Threat Model

| Threat | Defense |
|---|---|
| **Double-spend** (same tx for two challenges) | `ISeenTxStore.markUsed()` — atomic SET NX, globally unique per txHash |
| **Race condition** (two simultaneous proofs) | `IChallengeStore.transition()` — CAS, only one wins |
| **Replay attack** (testnet tx on mainnet) | `chainId` stored per challenge, asserted on proof submission |
| **Underpayment** | `Transfer.value >= challenge.amountRaw` enforced in `verifyTransfer()` |
| **Late payment** (tx after challenge expiry) | `block.timestamp <= challenge.expiresAt` enforced in `verifyTransfer()` |
| **Token replay** (reuse Bearer token) | `jti = challengeId` in JWT — middleware can track used JTIs |
| **Weak JWT secret** | `AccessTokenIssuer` enforces minimum 32-char secrets |
| **Resource billing risk** | Pre-flight `onVerifyResource` before issuing any challenge |

### What the SDK Does NOT Do

- No private key management for sellers (sellers hold their own receive wallets).
- No automatic refunds (the `onChallengeExpired` hook enables custom logic).
- No rate limiting (integrate at the infrastructure/framework level).
- No centralized registry or hosted service.

---

## Testing Strategy

Tests live in `src/core/__tests__/` and use `bun:test`.

### Key Patterns

**Injectable clock** — all time-sensitive tests use the `clock: () => number` parameter on `ChallengeEngine`. Never use `setTimeout` or `Date.now()` patching:

```typescript
let now = Date.now();
const { engine } = makeEngine({ clock: () => now });
now += 901_000; // advance past TTL
```

**Concurrency assertions** — use `Promise.all` + filter-Boolean:

```typescript
const [a, b] = await Promise.all([
  store.transition(id, "PENDING", "PAID", { ... }),
  store.transition(id, "PENDING", "EXPIRED"),
]);
expect([a, b].filter(Boolean).length).toBe(1);
```

**Store cleanup** — always construct with `cleanupIntervalMs: 0` and call `store.stopCleanup()`:

```typescript
const store = new InMemoryChallengeStore({ cleanupIntervalMs: 0 });
// test...
store.stopCleanup();
```

**MockPaymentAdapter** — controls verification outcomes:

```typescript
const adapter = new MockPaymentAdapter();
adapter.setVerifyResult({ success: false, error: "Transfer not found" });
```

### Coverage Areas

- Challenge engine: happy path, idempotency, expiry, double-spend, wrong tier, concurrent proofs
- Storage: `transition()` atomicity, `markUsed()` SET NX semantics, TTL cleanup
- Adapter: all six on-chain verification checks individually
- Middleware: token validation, expiry, signature mismatch
- Config validation: required fields, minimum secret length, valid network

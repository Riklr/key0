# AgentGate Payment Flow — Complete Lifecycle

This document describes the full payment lifecycle, Redis schema, HTTP request/response structures, state transitions, and all security checks.

---

## Table of Contents

1. [Overview](#overview)
2. [State Machine](#state-machine)
3. [Redis Schema](#redis-schema)
4. [Flow 1: A2A Protocol (Agent-to-Agent)](#flow-1-a2a-protocol-agent-to-agent)
5. [Flow 2: x402 HTTP (Browser/REST Client)](#flow-2-x402-http-browserrest-client)
6. [On-Chain Verification](#on-chain-verification)
7. [Token Issuance & Validation](#token-issuance--validation)
8. [Refund Lifecycle](#refund-lifecycle)
9. [Security Checks Summary](#security-checks-summary)

---

## Overview

AgentGate uses a **two-phase payment flow**: the client first requests access (receiving a payment challenge), then submits proof of payment (receiving an access token). There are two transport mechanisms:

| Transport | Entry Points | Settlement | Used By |
|-----------|-------------|------------|---------|
| **A2A Protocol** | `requestAccess()` + `submitProof()` | Client sends on-chain tx, server verifies receipt | AI agents via JSON-RPC |
| **x402 HTTP** | `POST /access` or `POST /jsonrpc` | Client signs EIP-3009 off-chain, server/facilitator settles | Browsers, REST clients |

Both flows share the same `ChallengeEngine`, Redis stores, and state machine.

---

## State Machine

```
                    requestAccess / requestHttpAccess
                              |
                              v
                         +---------+
                         | PENDING |
                         +---------+
                        /    |      \
                       /     |       \
              expired /  submitProof  \ cancelChallenge
                     /   processHttp   \
                    v       |           v
              +---------+   |     +-----------+
              | EXPIRED |   |     | CANCELLED |
              +---------+   |     +-----------+
                            v
                         +------+
                         | PAID |
                         +------+
                        /        \
            onIssueToken          \  refund cron (minAgeMs elapsed)
              success              \
                  |                 v
                  v           +----------------+
            +-----------+     | REFUND_PENDING |
            | DELIVERED |     +----------------+
            +-----------+      /             \
                              v               v
                       +----------+    +---------------+
                       | REFUNDED |    | REFUND_FAILED |
                       +----------+    +---------------+
```

### Allowed Transitions

| From | To | Trigger | Fields Written |
|------|----|---------|----------------|
| (new) | PENDING | `create()` | All base fields |
| PENDING | PAID | `submitProof()` / `processHttpPayment()` | `txHash`, `paidAt`, `fromAddress` |
| PENDING | EXPIRED | `submitProof()` (expiry check) | — |
| PENDING | CANCELLED | `cancelChallenge()` | — |
| PAID | DELIVERED | Token issued successfully | `accessGrant` (full JSON), `deliveredAt` |
| PAID | PENDING | `markUsed()` race rollback (extremely rare) | — |
| PAID | REFUND_PENDING | Refund cron claims record | — |
| REFUND_PENDING | REFUNDED | Refund tx confirmed | `refundTxHash`, `refundedAt` |
| REFUND_PENDING | REFUND_FAILED | Refund tx failed | `refundError` |

All transitions use **atomic Lua scripts** — if `currentState != expectedFromState`, the transition returns `false` and no fields are written.

---

## Redis Schema

### Key Naming Convention

All keys use the prefix `agentgate` (configurable via `keyPrefix`).

### 1. Challenge Record Hash — `agentgate:challenge:{challengeId}`

Stored as a Redis Hash (`HSET`/`HGETALL`). Each field is a string.

| Hash Field | Type | Set When | Example |
|-----------|------|----------|---------|
| `challengeId` | string | CREATE | `"http-a1b2c3d4-..."` or UUID |
| `requestId` | string | CREATE | `"550e8400-e29b-..."` (client-generated UUID) |
| `clientAgentId` | string | CREATE | `"did:web:agent.example"` or `"x402-http"` |
| `resourceId` | string | CREATE | `"photo-123"` or `"default"` |
| `tierId` | string | CREATE | `"basic"` |
| `amount` | string | CREATE | `"$0.10"` |
| `amountRaw` | string (bigint) | CREATE | `"100000"` (USDC 6-decimal micro-units) |
| `asset` | string | CREATE | `"USDC"` |
| `chainId` | string (number) | CREATE | `"84532"` (Base Sepolia) or `"8453"` (Base) |
| `destination` | string (0x) | CREATE | `"0xAbCd..."` (seller wallet) |
| `state` | string | CREATE, updated on transitions | `"PENDING"` / `"PAID"` / `"DELIVERED"` / etc. |
| `expiresAt` | ISO-8601 string | CREATE | `"2025-03-05T12:30:00.000Z"` |
| `createdAt` | ISO-8601 string | CREATE | `"2025-03-05T12:15:00.000Z"` |
| `txHash` | string (0x) | PENDING->PAID | `"0x1234..."` |
| `paidAt` | ISO-8601 string | PENDING->PAID | `"2025-03-05T12:16:00.000Z"` |
| `fromAddress` | string (0x) | PENDING->PAID | `"0xBuyer..."` (payer wallet) |
| `accessGrant` | JSON string | PAID->DELIVERED | Full `AccessGrant` object (see below) |
| `deliveredAt` | ISO-8601 string | PAID->DELIVERED | `"2025-03-05T12:16:05.000Z"` |
| `refundTxHash` | string (0x) | REFUND_PENDING->REFUNDED | `"0xRefund..."` |
| `refundedAt` | ISO-8601 string | REFUND_PENDING->REFUNDED | `"2025-03-05T12:21:00.000Z"` |
| `refundError` | string | REFUND_PENDING->REFUND_FAILED | `"insufficient gas"` |

**TTL**: 7 days (`recordTTLSeconds`, default 604,800s). Shortened to 12 hours (`deliveredTTLSeconds`, default 43,200s) when state reaches DELIVERED.

### 2. Request Index — `agentgate:request:{requestId}`

A simple `SET` key mapping `requestId -> challengeId`. Used for **idempotency**: if the same `requestId` is submitted again, the existing challenge is returned instead of creating a new one.

```
KEY:   agentgate:request:550e8400-e29b-...
VALUE: http-a1b2c3d4-...
TTL:   900s (challengeTTLSeconds)
```

**Written**: When `create()` is called (pipeline with the challenge hash).
**Read**: By `findActiveByRequestId()` during idempotency checks.

### 3. Seen Transaction Set — `agentgate:seentx:{txHash}`

A simple `SET NX` key for **double-spend prevention**. Maps `txHash -> challengeId`.

```
KEY:   agentgate:seentx:0x1234abcd...
VALUE: http-a1b2c3d4-...
TTL:   7 days (604,800s)
```

**Written**: `markUsed(txHash, challengeId)` — uses `SET ... NX` so only the first writer wins.
**Read**: `get(txHash)` — checked before on-chain verification and before `markUsed`.

### 4. Paid Set (Sorted Set) — `agentgate:paid`

A Redis Sorted Set tracking PAID records for the refund cron.

```
ZADD agentgate:paid <paidAt_epoch_ms> <challengeId>
```

| Operation | When |
|-----------|------|
| `ZADD` | State transitions to PAID (score = `paidAt` epoch ms) |
| `ZREM` | State transitions FROM PAID (to DELIVERED, REFUND_PENDING, etc.) |
| `ZRANGEBYSCORE 0 <cutoff>` | Refund cron queries records older than `minAgeMs` |

### Redis Commands Per Operation

| Operation | Redis Commands |
|-----------|---------------|
| **create** | Pipeline: `HSET` (challenge hash) + `EXPIRE` (7d) + `SET EX` (request index, 900s) |
| **get** | `HGETALL` |
| **findActiveByRequestId** | `GET` (request index) -> `HGETALL` (challenge hash) |
| **transition** | `EVAL` (Lua: check state + `HSET` atomically) + conditional `ZADD`/`ZREM` + conditional `EXPIRE` |
| **markUsed** | `SET NX EX` (7d) |
| **findPendingForRefund** | `ZRANGEBYSCORE` -> N x `HGETALL` |

### Lua Script (Atomic Transition)

```lua
local current = redis.call('HGET', KEYS[1], 'state')
if current ~= ARGV[1] then
  return 0  -- state mismatch, transition rejected
end
redis.call('HSET', KEYS[1], 'state', ARGV[2])
for i = 3, #ARGV, 2 do
  redis.call('HSET', KEYS[1], ARGV[i], ARGV[i+1])
end
return 1
```

`KEYS[1]` = `agentgate:challenge:{challengeId}`, `ARGV[1]` = fromState, `ARGV[2]` = toState, `ARGV[3..N]` = field/value pairs.

---

## Flow 1: A2A Protocol (Agent-to-Agent)

Used by AI agents communicating over the A2A JSON-RPC protocol.

### Phase 1: Request Access

**Client sends** `AccessRequest`:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "resourceId": "photo-123",
  "tierId": "basic",
  "clientAgentId": "did:web:buyer.example"
}
```

**Engine steps** (`requestAccess()`):

1. Validate `requestId` (UUID format)
2. Look up `tierId` in `SellerConfig.products`
3. Call `onVerifyResource(resourceId, tierId)` with 5s timeout — pre-flight check
4. **Idempotency check**: `store.findActiveByRequestId(requestId)`
   - If PENDING and not expired -> return existing challenge
   - If DELIVERED with grant -> throw `PROOF_ALREADY_REDEEMED` (200, includes grant)
   - If EXPIRED/CANCELLED -> fall through to create new
5. Call `adapter.issueChallenge()` to get a `challengeId`
6. Build `ChallengeRecord` with state=PENDING
7. `store.create(record)` -> writes Redis hash + request index
8. Return `X402Challenge`

**Server responds** with `X402Challenge`:

```json
{
  "type": "X402Challenge",
  "challengeId": "a1b2c3d4-e5f6-...",
  "requestId": "550e8400-e29b-...",
  "tierId": "basic",
  "amount": "$0.10",
  "asset": "USDC",
  "chainId": 84532,
  "destination": "0xSellerWallet...",
  "expiresAt": "2025-03-05T12:30:00.000Z",
  "description": "Send $0.10 USDC to 0xSeller... on chain 84532. Then call...",
  "resourceVerified": true
}
```

**Redis after Phase 1:**

```
agentgate:challenge:a1b2c3d4-...  (HASH, TTL 7d)
  challengeId = a1b2c3d4-...
  requestId   = 550e8400-...
  state       = PENDING
  amount      = $0.10
  amountRaw   = 100000
  chainId     = 84532
  destination = 0xSeller...
  expiresAt   = 2025-03-05T12:30:00.000Z
  createdAt   = 2025-03-05T12:15:00.000Z
  ...

agentgate:request:550e8400-...  (STRING, TTL 900s)
  = a1b2c3d4-...
```

### Phase 2: Submit Proof

Client executes an on-chain USDC transfer, then submits proof.

**Client sends** `PaymentProof`:

```json
{
  "type": "PaymentProof",
  "challengeId": "a1b2c3d4-...",
  "requestId": "550e8400-...",
  "chainId": 84532,
  "txHash": "0xabcdef1234567890...",
  "amount": "$0.10",
  "asset": "USDC",
  "fromAgentId": "did:web:buyer.example"
}
```

**Engine steps** (`submitProof()`):

1. Validate `challengeId` (non-empty) and `txHash` (0x-prefixed, 66 chars)
2. `store.get(challengeId)` — load challenge record
3. **State check**: if DELIVERED with grant -> `PROOF_ALREADY_REDEEMED`; if not PENDING -> `CHALLENGE_EXPIRED`
4. **Expiry check**: if `expiresAt <= now` -> transition PENDING->EXPIRED, throw
5. **Chain mismatch guard**: `proof.chainId !== challenge.chainId` -> throw
6. **Amount guard**: `proof.amount !== challenge.amount` -> throw
7. **Double-spend guard**: `seenTxStore.get(txHash)` -> if exists, throw `TX_ALREADY_REDEEMED`
8. **On-chain verification**: `adapter.verifyProof()` (see [On-Chain Verification](#on-chain-verification))
9. **Atomic transition**: `store.transition(challengeId, "PENDING", "PAID", { txHash, paidAt, fromAddress })`
   - If returns `false` -> concurrent request already transitioned; reload and check
10. **Mark txHash**: `seenTxStore.markUsed(txHash, challengeId)` — SET NX
    - If returns `false` -> extremely rare race; rollback PAID->PENDING, throw
11. **Issue token**: call `config.onIssueToken({ requestId, challengeId, resourceId, tierId, txHash })`
12. Build `AccessGrant` object
13. **Transition to DELIVERED**: `store.transition(challengeId, "PAID", "DELIVERED", { accessGrant, deliveredAt })`
14. Fire `onPaymentReceived` hook (async, non-blocking)
15. Return `AccessGrant`

**Server responds** with `AccessGrant`:

```json
{
  "type": "AccessGrant",
  "challengeId": "a1b2c3d4-...",
  "requestId": "550e8400-...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresAt": "2025-03-05T13:15:00.000Z",
  "resourceEndpoint": "https://api.example.com/photos/photo-123",
  "resourceId": "photo-123",
  "tierId": "basic",
  "txHash": "0xabcdef1234567890...",
  "explorerUrl": "https://sepolia.basescan.org/tx/0xabcdef..."
}
```

**Redis after Phase 2:**

```
agentgate:challenge:a1b2c3d4-...  (HASH, TTL reset to 12h)
  state       = DELIVERED
  txHash      = 0xabcdef...
  paidAt      = 2025-03-05T12:16:00.000Z
  fromAddress = 0xBuyer...
  accessGrant = {"type":"AccessGrant","challengeId":"a1b2c3d4-...",...}
  deliveredAt = 2025-03-05T12:16:05.000Z
  ... (all original fields unchanged)

agentgate:seentx:0xabcdef...  (STRING, TTL 7d)
  = a1b2c3d4-...

agentgate:paid  (SORTED SET)
  (challengeId was added then removed — net empty for this challenge)
```

### Phase 3: Access Protected Resource

**Client sends** request with Bearer token:

```
POST /api/photos/photo-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Middleware** (`validateAccessToken`):

1. Extract token from `Authorization: Bearer <token>` header
2. Verify JWT signature (HS256 with shared secret, or RS256 with public key)
3. Check expiration (`exp` claim)
4. Attach decoded claims to request object as `req.agentGateToken`
5. Call `next()` to pass to route handler

**JWT Claims** (decoded payload):

```json
{
  "sub": "550e8400-...",
  "jti": "a1b2c3d4-...",
  "resourceId": "photo-123",
  "tierId": "basic",
  "txHash": "0xabcdef...",
  "iat": 1741176960,
  "exp": 1741180560
}
```

---

## Flow 2: x402 HTTP (Browser/REST Client)

Used by clients that interact via standard HTTP headers instead of the A2A JSON-RPC protocol. The client signs an EIP-3009 authorization off-chain; a facilitator or gas wallet settles on-chain.

### Step 1: Request (No Payment) -> HTTP 402

**Client sends**:

```
POST /a2a/access
Content-Type: application/json

{
  "tierId": "basic",
  "requestId": "550e8400-...",
  "resourceId": "photo-123"
}
```

No `PAYMENT-SIGNATURE` header present.

**Engine steps** (`requestHttpAccess()`):

1. Validate tier and resource (same as A2A flow)
2. Idempotency check via `store.findActiveByRequestId(requestId)`
3. Generate `challengeId` with `http-` prefix: `http-{uuid}`
4. Create PENDING `ChallengeRecord` with `clientAgentId = "x402-http"`
5. `store.create(record)` -> Redis hash + request index

**Server responds** with HTTP 402:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVm... (base64-encoded PaymentRequirements)
Content-Type: application/json

{
  "x402Version": 2,
  "resource": {
    "url": "https://api.example.com/a2a/jsonrpc",
    "method": "POST",
    "description": "Access to photo-123",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:84532",
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "amount": "100000",
      "payTo": "0xSellerWallet...",
      "maxTimeoutSeconds": 300,
      "extra": {
        "name": "USDC",
        "version": "2",
        "description": "Basic tier access - $0.10 USDC"
      }
    }
  ],
  "challengeId": "http-a1b2c3d4-...",
  "error": "PAYMENT-SIGNATURE header is required"
}
```

### Step 2: Payment -> HTTP 200

Client signs an EIP-3009 `transferWithAuthorization` off-chain and re-sends the request.

**Client sends**:

```
POST /a2a/access
Content-Type: application/json
PAYMENT-SIGNATURE: eyJ4NDAyVm... (base64url-encoded X402PaymentPayload)

{
  "tierId": "basic",
  "requestId": "550e8400-...",
  "resourceId": "photo-123"
}
```

**`PAYMENT-SIGNATURE` header** (decoded):

```json
{
  "x402Version": 2,
  "network": "eip155:84532",
  "scheme": "exact",
  "payload": {
    "signature": "0xSignedEIP3009...",
    "authorization": {
      "from": "0xBuyer...",
      "to": "0xSeller...",
      "value": "100000",
      "validAfter": "0",
      "validBefore": "1741180560",
      "nonce": "0xRandomNonce..."
    }
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:84532",
    "asset": "0x036CbD...",
    "amount": "100000",
    "payTo": "0xSeller...",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USDC", "version": "2" }
  }
}
```

**Settlement steps**:

1. `decodePaymentSignature(header)` — base64url/base64 decode to `X402PaymentPayload`
2. `settlePayment(payload, config, networkConfig)`:
   - If `config.gasWalletPrivateKey` is set -> **Gas Wallet mode**: use `ExactEvmScheme` from `@x402/evm` to verify + settle locally
   - Otherwise -> **Facilitator mode**: POST to `facilitatorUrl/verify` then `facilitatorUrl/settle`
3. Returns `{ txHash, settleResponse, payer }`

**Engine steps** (`processHttpPayment()`):

1. Validate tier and resource
2. **Double-spend guard**: `seenTxStore.get(txHash)`
3. Find PENDING record by `requestId` or auto-create one if Step 1 was skipped
4. **Atomic transition**: PENDING -> PAID (with `txHash`, `paidAt`, `fromAddress`)
5. **Mark txHash**: `seenTxStore.markUsed(txHash, challengeId)`
6. **Issue token**: call `config.onIssueToken()`
7. Build `AccessGrant`
8. **Transition**: PAID -> DELIVERED (with `accessGrant`, `deliveredAt`)
9. Fire `onPaymentReceived` hook

**Server responds** with HTTP 200:

```
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNz... (base64-encoded X402SettleResponse)
Content-Type: application/json

{
  "type": "AccessGrant",
  "challengeId": "http-a1b2c3d4-...",
  "requestId": "550e8400-...",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "tokenType": "Bearer",
  "expiresAt": "2025-03-05T13:15:00.000Z",
  "resourceEndpoint": "https://api.example.com/photos/photo-123",
  "resourceId": "photo-123",
  "tierId": "basic",
  "txHash": "0xSettledTx...",
  "explorerUrl": "https://sepolia.basescan.org/tx/0xSettledTx..."
}
```

**`PAYMENT-RESPONSE` header** (decoded):

```json
{
  "success": true,
  "transaction": "0xSettledTx...",
  "network": "eip155:84532",
  "payer": "0xBuyer..."
}
```

### x402 HTTP via JSON-RPC Middleware

The same flow also works on the `/a2a/jsonrpc` endpoint. The `createX402HttpMiddleware` intercepts `message/send` JSON-RPC calls:

- If `X-A2A-Extensions` header is present -> pass through to A2A handler (native A2A client)
- If `method === "message/send"` and no `PAYMENT-SIGNATURE` -> return HTTP 402
- If `method === "message/send"` and has `PAYMENT-SIGNATURE` -> settle and return AccessGrant

The middleware parses `AccessRequest` from `params.message.parts` (either a `data` part with `type: "AccessRequest"` or a `text` part containing JSON).

---

## On-Chain Verification

Used only in the **A2A flow** (Flow 1). The x402 HTTP flow relies on the facilitator/gas-wallet for verification.

`verifyTransfer()` performs 6 checks against the blockchain:

| Step | Check | Error Code | HTTP |
|------|-------|-----------|------|
| 1 | Fetch tx receipt from RPC | `TX_NOT_FOUND` / `RPC_ERROR` | 202 / 400 |
| 2 | Receipt status != reverted | `TX_REVERTED` | 400 |
| 3 | Find USDC Transfer events to `destination` | `WRONG_RECIPIENT` | 400 |
| 4 | Sum of transfers >= `expectedAmountRaw` | `AMOUNT_INSUFFICIENT` | 400 |
| 5 | Block timestamp <= `challengeExpiresAt` | `TX_AFTER_EXPIRY` | 400 |
| 6 | All pass | verified: true | 200 |

The function also extracts `fromAddress` from the first matching Transfer event log.

---

## Token Issuance & Validation

### Issuance

Token issuance is **fully delegated** to the seller via `config.onIssueToken()`. The callback receives:

```typescript
{
  requestId: string;
  challengeId: string;
  resourceId: string;
  tierId: string;
  txHash: string;
}
```

And must return:

```typescript
{
  token: string;       // The access token (JWT, API key, etc.)
  expiresAt: Date;     // When the token expires
  tokenType?: string;  // Default "Bearer"
}
```

The built-in `AccessTokenIssuer` class supports HS256 (shared secret) and RS256 (private key) JWTs with these claims:

| Claim | Value |
|-------|-------|
| `sub` | requestId |
| `jti` | challengeId |
| `resourceId` | Resource identifier |
| `tierId` | Product tier |
| `txHash` | On-chain transaction hash |
| `iat` | Issued-at timestamp |
| `exp` | Expiration timestamp |

### Validation

`validateAccessToken` middleware:

1. Extract `Bearer <token>` from `Authorization` header
2. Verify JWT with `jose.jwtVerify(token, secret)`
3. If expired -> `CHALLENGE_EXPIRED` (401)
4. If invalid -> `INVALID_REQUEST` (401)
5. Attach decoded payload to `req.agentGateToken`

Supports **fallback secrets** via `verifyWithFallback()` for zero-downtime secret rotation.

---

## Refund Lifecycle

The refund cron handles PAID records that were never DELIVERED (e.g., `onIssueToken` failed or the client disappeared).

### How It Works

1. **Query**: `store.findPendingForRefund(minAgeMs)` runs `ZRANGEBYSCORE agentgate:paid 0 <cutoff>` to find PAID records older than `minAgeMs` (default 5 minutes)
2. **Claim**: For each record, atomically transition PAID -> REFUND_PENDING (prevents double-refund from concurrent cron workers)
3. **Send**: Call `sendUsdc()` to transfer USDC back to `record.fromAddress`
4. **Success**: Transition REFUND_PENDING -> REFUNDED with `refundTxHash` and `refundedAt`
5. **Failure**: Transition REFUND_PENDING -> REFUND_FAILED with `refundError` (needs operator attention; cron will NOT retry)

### Redis During Refund

```
# After PAID -> REFUND_PENDING claim:
agentgate:paid (SORTED SET)
  (challengeId removed via ZREM)

agentgate:challenge:{challengeId}
  state = REFUND_PENDING

# After successful refund:
agentgate:challenge:{challengeId}
  state        = REFUNDED
  refundTxHash = 0xRefund...
  refundedAt   = 2025-03-05T12:21:00.000Z
```

---

## Security Checks Summary

### Per-Request Checks (in order of execution)

| # | Check | Where | Prevents |
|---|-------|-------|----------|
| 1 | UUID format validation | `validateUUID()` | Malformed requestId |
| 2 | Tier exists in product catalog | `findTier()` | Invalid tier requests |
| 3 | Resource verification | `onVerifyResource()` with timeout | Access to nonexistent resources |
| 4 | Idempotency (requestId lookup) | `store.findActiveByRequestId()` | Duplicate challenge creation |
| 5 | State check (PENDING required) | `challenge.state` check | Acting on expired/cancelled challenges |
| 6 | Expiry check | `expiresAt <= now` | Late payments |
| 7 | Chain ID match | `proof.chainId !== challenge.chainId` | Cross-chain replay |
| 8 | Amount match | `proof.amount !== challenge.amount` | Underpayment |
| 9 | Double-spend pre-check | `seenTxStore.get(txHash)` | Reusing a txHash |
| 10 | On-chain verification | `adapter.verifyProof()` | Fake/insufficient/reverted txs |
| 11 | Atomic state transition | Lua `HGET + HSET` | Concurrent double-redemption |
| 12 | Atomic txHash claim | `SET NX` | Race condition double-spend |

### Invariants

1. **State transitions are atomic** — Lua script checks current state before writing; concurrent transitions are rejected
2. **Double-spend is impossible** — `SET NX` on `agentgate:seentx:{txHash}` ensures one txHash maps to exactly one challenge; if `markUsed` fails, the PAID state is rolled back to PENDING
3. **On-chain verification is complete** — receipt status, USDC Transfer event, recipient, amount, and block timestamp are all checked
4. **JWT security** — minimum 32-char secret, supports HS256/RS256, fallback secrets for rotation
5. **Refunds cannot double-fire** — atomic PAID->REFUND_PENDING transition ensures only one cron worker processes each record

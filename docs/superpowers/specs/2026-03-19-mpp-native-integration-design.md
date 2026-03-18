# MPP Native Integration — Design Spec

**Date:** 2026-03-19
**Branch:** feat/mpp
**Status:** Draft

---

## Problem Statement

Key0 today uses the x402 protocol for payment negotiation. x402 is a Coinbase-specific wire format that only accepts USDC on Base. This creates two hard blockers for API sellers:

1. **Interoperability:** Only agents that implement Key0's custom x402 flow can pay. Any agent built on `mppx` or another MPP-compliant SDK cannot pay a Key0-protected API without custom integration work.

2. **Single payment rail:** Sellers can only receive USDC on Base. Agents without a crypto wallet — paying via Stripe, card, or Lightning — cannot access Key0-protected APIs at all.

MPP (Machine Payments Protocol) is an IETF-proposed standard that generalises HTTP 402 payment negotiation to be payment-rail agnostic. It solves both problems simultaneously.

---

## Goals

- Any MPP-compliant agent can pay a Key0-protected API out of the box.
- Sellers can accept multiple payment methods (USDC on Base, Stripe, Lightning) from a single endpoint.
- Sellers explicitly declare which payment methods they accept at config time.
- Key0's internal value-add (state machine, JWT issuance, audit trail, replay protection, A2A discovery) is unaffected.
- The on-chain USDC/Base verification logic is preserved exactly as-is.

## Non-Goals

- Backward compatibility with x402 wire format (no existing sellers).
- Buyer/client SDK (out of scope per SPEC.md).
- Subscription/recurring billing.

---

## Layer Architecture

MPP replaces x402 as the payment negotiation layer only. Everything above it is unchanged.

```
┌──────────────────────────────────────────────────────┐
│  KEY0 VALUE-ADD LAYER (no changes)                   │
│                                                      │
│  • Agent card / A2A discovery                        │
│  • Plan catalog (planId, unitAmount, description)    │
│  • State machine (PENDING→PAID→DELIVERED→REFUNDED)   │
│  • IChallengeStore / ISeenTxStore / IAuditStore      │
│  • JWT issuance (AccessTokenIssuer)                  │
│  • Replay protection (markUsed atomic SET NX)        │
│  • onPaymentReceived / onChallengeExpired hooks      │
└──────────────────────────────────────────────────────┘
                       ↑
              verified payment event
                       ↑
┌──────────────────────────────────────────────────────┐
│  MPP PAYMENT NEGOTIATION LAYER (replaces x402)       │
│                                                      │
│  • WWW-Authenticate: Payment … (challenge headers)   │
│  • Authorization: Payment … (credential parsing)     │
│  • Payment-Receipt: … (optional receipt header)      │
│  • RFC 9457 Problem Details on failures              │
│  • IPaymentAdapter per method                        │
└──────────────────────────────────────────────────────┘
                       ↑
              on-chain / off-chain rails
                       ↑
┌──────────────────────────────────────────────────────┐
│  PAYMENT RAILS (no changes)                          │
│                                                      │
│  • USDC on Base — viem verification (today)          │
│  • Stripe API (new adapter, additive)                │
│  • Lightning (new adapter, additive)                 │
└──────────────────────────────────────────────────────┘
```

---

## IPaymentAdapter — MPP Method Interface

Each adapter maps to one MPP payment method. The interface aligns with MPP's custom method contract.

```typescript
interface IPaymentAdapter {
  readonly method: string;          // "base-usdc", "stripe", "lightning"
  readonly intent: "charge" | "session";

  // Returns the `request` object encoded in WWW-Authenticate: Payment request="…"
  buildChallengeRequest(params: IssueChallengeParams): Promise<MppChallengeRequest>;

  // Verifies the `payload` from Authorization: Payment credential
  verifyCredential(params: MppVerifyParams): Promise<VerificationResult>;

  // Returns the receipt `reference` field (tx hash, PaymentIntent ID, etc.)
  buildReceipt(result: VerificationResult): MppReceiptReference;
}
```

### BaseUsdcAdapter

Wraps the existing `X402Adapter` viem verification logic. The on-chain code is unchanged — only the envelope changes.

```typescript
class BaseUsdcAdapter implements IPaymentAdapter {
  readonly method = "base-usdc";  // custom MPP method — Key0 publishes the spec
  readonly intent = "charge";

  buildChallengeRequest({ amount, walletAddress }) {
    return {
      amount: toBaseUnits(amount),
      currency: USDC_ADDRESS,       // 0x833589f… on mainnet
      recipient: walletAddress,
    };
  }

  verifyCredential({ payload, challenge }) {
    // identical to current X402Adapter viem verification
    return this.verifyTransfer(payload.txHash, challenge);
  }

  buildReceipt({ txHash }) {
    return { reference: txHash };
  }
}
```

**Note:** `base-usdc` is a custom MPP method. Key0 must publish its request/payload schemas as a method spec so external MPP clients can implement it. Ideally, Key0 contributes a `base-usdc` client implementation to `mppx` so agents using that SDK can pay Key0 sellers automatically.

### StripeAdapter (future)

Must conform to MPP's existing `stripe` method spec (not invent its own). This gives automatic compatibility with any MPP client that already knows `stripe`.

```typescript
class StripeAdapter implements IPaymentAdapter {
  readonly method = "stripe";   // MPP-defined method — must follow MPP's stripe schemas
  readonly intent = "charge";

  buildChallengeRequest({ amount }) {
    const intent = await stripe.paymentIntents.create({ amount, currency: "usd" });
    return { clientSecret: intent.client_secret, amount };
  }

  verifyCredential({ payload }) {
    const intent = await stripe.paymentIntents.retrieve(payload.paymentIntentId);
    return { success: intent.status === "succeeded" };
  }

  buildReceipt({ paymentIntentId }) {
    return { reference: paymentIntentId };
  }
}
```

---

## Challenge Engine Changes

### Issuing challenges (402 path)

The engine iterates all enabled adapters, calls `buildChallengeRequest()` on each, stores one challenge record per method, and emits one `WWW-Authenticate: Payment` header per method.

```
Incoming request (no credential)
         ↓
for each adapter in config.paymentMethods:
  buildChallengeRequest() → request object
  generate HMAC-bound challenge id
  IChallengeStore.store(challenge)
  build WWW-Authenticate: Payment header string
         ↓
HTTP/1.1 402 Payment Required
Cache-Control: no-store
Content-Type: application/problem+json
WWW-Authenticate: Payment id="abc", method="base-usdc", intent="charge", realm="…", expires="…", request="eyJ…"
WWW-Authenticate: Payment id="def", method="stripe",   intent="charge", realm="…", expires="…", request="eyJ…"

{ "type": "https://paymentauth.org/problems/payment-required", "status": 402 }
```

Challenge IDs are HMAC-bound to their parameters (realm, method, intent, request hash, expires) to prevent clients from reusing an ID with modified payment terms.

### Verifying credentials (retry path)

```
Incoming request
Authorization: Payment <base64url>
         ↓
Decode → extract challenge.method
Look up stored challenge by challenge.id
Assert challenge.method === credential.challenge.method
Route to matching adapter.verifyCredential()
         ↓
VerificationResult { success: true }
         ↓
IChallengeStore.transition(id, PENDING → PAID)      ← unchanged
ISeenTxStore.markUsed(reference, challengeId)       ← unchanged, replay protection
         ↓
fetchResourceCredentials() → JWT                    ← unchanged
         ↓
HTTP/1.1 200 OK
Payment-Receipt: eyJ…                               ← new header
Authorization: Bearer <jwt>                         ← unchanged
```

### What is unchanged in the engine

- `PENDING → PAID → DELIVERED → REFUNDED` state machine
- `IChallengeStore.transition()` atomic compare-and-swap
- `ISeenTxStore.markUsed()` double-spend prevention
- `fetchResourceCredentials()` JWT issuance
- `onPaymentReceived` / `onChallengeExpired` hooks
- Expiry and idempotency logic

---

## Seller Config API

`paymentMethods` is a required field. Sellers must be explicit — no defaults, no fallbacks.

```typescript
import { createKey0, baseUsdc, stripe, lightning } from "@key0ai/key0";

createKey0({
  walletAddress: "0x…",
  network: "mainnet",
  plans: [
    { planId: "basic",   unitAmount: "0.10" },
    { planId: "premium", unitAmount: "5.00" },
  ],
  paymentMethods: [
    baseUsdc(),
    stripe({ secretKey: "sk_live_…" }),
    lightning({ node: "…", macaroon: "…" }),
  ],
  fetchResourceCredentials: async ({ planId }) => { … },
});
```

Factory function signatures:

```typescript
baseUsdc(options?: {
  network?: "mainnet" | "testnet";   // inherits from SellerConfig if omitted
  mode?: "pull" | "push";
})

stripe(options: {
  secretKey: string;
  webhookSecret?: string;
})

lightning(options: {
  node: string;
  macaroon: string;
})
```

Each factory returns a configured `IPaymentAdapter` instance. Sellers never instantiate adapter classes directly.

**Plan-level method restriction (optional):**

```typescript
plans: [
  { planId: "basic",   unitAmount: "0.10" },                          // all methods
  { planId: "premium", unitAmount: "5.00", methods: ["base-usdc"] }, // crypto only
],
```

When the engine issues challenges for a restricted plan, it only iterates adapters in the plan's `methods` list.

---

## Integration Layer

### HTTP integrations (Express, Hono, Fastify)

Unified pattern across all three frameworks:

```
Incoming request
      ↓
Does Authorization: Payment header exist?
      ├── No  → engine.requestHttpAccess() → WWW-Authenticate headers → 402
      └── Yes → decode base64url credential
                 extract challenge.id + challenge.method
                 engine.processHttpPayment() → 200 + Payment-Receipt + JWT
```

**RFC 9457 error bodies on all 402 responses:**

| Condition | Problem type URI |
|---|---|
| No credential | `payment-required` |
| Expired challenge | `payment-expired` |
| Already-used reference | `invalid-challenge` |
| Amount too low | `payment-insufficient` |
| Bad credential JSON | `malformed-credential` |
| On-chain verify failed | `verification-failed` |

### MCP integration

Replaces Key0's custom `isError`/`structuredContent` signalling with the MPP standard.

**Challenge (server → agent):** JSON-RPC error code `-32042`

```json
{
  "code": -32042,
  "message": "Payment Required",
  "data": {
    "httpStatus": 402,
    "challenges": [
      { "id": "…", "method": "base-usdc", "intent": "charge", "request": { … } },
      { "id": "…", "method": "stripe",   "intent": "charge", "request": { … } }
    ]
  }
}
```

**Credential (agent → server):** `_meta["org.paymentauth/credential"]`

```json
{
  "method": "tools/call",
  "params": {
    "name": "…",
    "arguments": { … },
    "_meta": {
      "org.paymentauth/credential": {
        "challenge": { … },
        "source": "0x…",
        "payload": { … }
      }
    }
  }
}
```

**Receipt (server → agent):** `_meta["org.paymentauth/receipt"]`

```json
{
  "result": {
    "content": [ … ],
    "_meta": {
      "org.paymentauth/receipt": {
        "status": "success",
        "challengeId": "…",
        "method": "base-usdc"
      }
    }
  }
}
```

---

## Security Invariants (unchanged)

All existing Key0 security invariants are preserved and remain aligned with MPP's requirements:

| Invariant | MPP Requirement | Key0 Implementation |
|---|---|---|
| Single-use proofs | Credentials valid exactly once | `ISeenTxStore.markUsed()` atomic SET NX |
| No side effects before payment | Servers must not modify state for unpaid requests | `preSettlementCheck()` guard |
| Challenge binding | `id` cryptographically bound to parameters | HMAC-bound challenge IDs |
| TLS required | TLS 1.2+ for all payment flows | Standard HTTPS deployment |
| No credential logging | Credentials must not appear in logs | Key0 does not log raw credentials |
| Replay protection | Same proof cannot be reused | `ISeenTxStore` + state machine |

---

## Files Affected

| File | Change |
|---|---|
| `src/types/index.ts` | Update `IPaymentAdapter` to MPP method interface |
| `src/adapter/index.ts` | Rename/refactor `X402Adapter` → `BaseUsdcAdapter` |
| `src/core/challenge-engine.ts` | Multi-adapter iteration on 402 path; method routing on credential path |
| `src/integrations/settlement.ts` | Replace `buildHttpPaymentRequirements` with MPP header builder; replace `decodePaymentSignature` with MPP credential decoder |
| `src/integrations/express.ts` | Parse `Authorization: Payment`; emit `WWW-Authenticate: Payment`; RFC 9457 errors |
| `src/integrations/hono.ts` | Same as Express |
| `src/integrations/fastify.ts` | Same as Express |
| `src/integrations/mcp.ts` | Replace `isError`/`structuredContent` with `-32042` + `_meta` |
| `src/factory.ts` | Add `paymentMethods` to `SellerConfig`; wire adapter registry |
| `src/index.ts` | Export `baseUsdc`, `stripe`, `lightning` factory functions |

---

## Out of Scope for This Spec

- `StripeAdapter` implementation (architecture is defined; implementation is a follow-on)
- `LightningAdapter` implementation (same)
- Publishing `base-usdc` method spec to MPP ecosystem / contributing to `mppx`
- Client SDK for paying Key0-protected APIs

---
name: payment-invariants
description: The 5 security invariants that protect AgentGate's payment flow. Load this to know what must never be broken — and therefore what must always be tested and reviewed.
---

# AgentGate Payment Security Invariants

These are the 5 rules that must hold at all times. Violating any one of them means someone can get paid access without paying, pay once and receive multiple tokens, or corrupt the payment state.

---

## Invariant 1 — All State Changes Go Through `transition()`

All challenge state changes MUST use `IChallengeStore.transition(id, fromState, toState, updates)`. Direct writes that bypass the compare-and-swap guard are forbidden.

**Why**: Without CAS, two concurrent `submitProof` calls both read `PENDING`, both pass verification, and both issue a token — one payment, two tokens.

**The rule**: `transition()` only writes if the current state matches `fromState`. If another caller already changed the state, this call returns `false` and must abort.

Forbidden patterns:
- Calling `store.set()`, `store.update()`, or direct Map/Redis writes to change `state`
- Reading state and writing it back without going through `transition()`

---

## Invariant 2 — `markUsed()` Return Value Is Checked, with Rollback Guard

`ISeenTxStore.markUsed(txHash, challengeId)` is an atomic SET NX. It returns `false` if that txHash was already used — abort immediately.

**Why**: Without this, the same on-chain transaction can be submitted as proof for two different challenges. One real payment → two different resources unlocked.

Three things must all be present:
1. `markUsed()` is called before issuing the token
2. A `false` return value aborts the flow (double-spend attempt)
3. **Rollback guard**: if `markUsed()` succeeds but the subsequent `transition()` to PAID fails, `unmarkUsed()` (or equivalent) must restore the txHash — otherwise the honest client can never retry with the same tx

---

## Invariant 3 — On-Chain Verification Runs All Six Checks

`verifyTransfer()` must verify ALL of the following. Skipping any one opens a specific attack:

| # | Check | Attack if skipped |
|---|---|---|
| 1 | `receipt.status === "success"` | Reverted tx accepted — no USDC moved |
| 2 | ERC-20 Transfer event in logs | Any contract interaction accepted, not just transfers |
| 3 | `Transfer.to === challenge.destination` | Payment to attacker's own address accepted |
| 4 | `Transfer.value >= challenge.amountRaw` | Underpayment accepted |
| 5 | `chainId` matches `challenge.chainId` | Free testnet USDC satisfies a mainnet challenge |
| 6 | `block.timestamp <= challenge.expiresAt` | Post-expiry payment accepted |

All six checks are required. Partial verification is not sufficient.

---

## Invariant 4 — JWT Claims and Secret Strength

JWTs issued after payment must:
- Set `jti` = `challengeId` — links the token to the specific challenge for replay detection
- Set `exp` — tokens without expiry are valid forever, even after access should be revoked
- Use HS256 with secret ≥ 32 characters, OR RS256 with a proper key pair

Forbidden:
- Missing `jti` claim
- Missing `exp` claim
- Secrets shorter than 32 characters (brute-forceable)
- `alg: "none"` or algorithm confusion (e.g. switching HS256 to RS256 using a public key as the secret)

---

## Invariant 5 — Callback Boundary Safety

`onPaymentReceived` and `onIssueToken` are user-supplied callbacks that run after the critical payment path.

**`onPaymentReceived`** — MUST be fire-and-forget:
- Called with `.catch(noop)` and not awaited in the main flow
- If awaited and the webhook is slow/down: client times out, retries, risks double-processing

**`onIssueToken`** — MUST have errors caught:
- Its return value (the token) is required, so it is awaited — this is correct
- But if it throws uncaught: payment is captured (challenge = PAID), no token issued, client paid for nothing
- Errors must be caught and surfaced as a recoverable failure, not a crash

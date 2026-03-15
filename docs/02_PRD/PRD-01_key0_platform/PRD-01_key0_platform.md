---
tags:
  - prd
  - layer-2-artifact
document_type: prd
artifact_type: PRD
layer: 2
architecture_approaches:
  - saas
  - open-source-sdk
  - event-driven
  - webhook-based
  - on-chain-verification
priority: primary
development_status: draft
---

# Key0 Platform PRD

---

## 1. Document Control

| Field | Value |
|---|---|
| Status | Draft |
| Version | 0.5 |
| Date Created | 2026-03-14 |
| Last Updated | 2026-03-15 |
| Author | Srijan |
| Reviewer | Pending |
| Approver | Pending |
| BRD Reference | N/A — standalone PRD (no upstream BRD) |
| SYS-Ready Score | 78/100 (Target: ≥90) |
| EARS-Ready Score | 78/100 (Target: ≥90) |

> **Note**: SYS-Ready and EARS-Ready scores are estimated post-structural-fix. Re-run `/doc-prd-audit` after filling §13 (Implementation Approach) and §15 (Budget & Resources) stubs to confirm final scores.

### Document Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 0.1 | 2026-03-14 | Srijan | Initial draft — commerce lifecycle, personas, Part 1 Agent-Ready |
| 0.2 | 2026-03-14 | Srijan | Added Part 2 Network (registry, reputation, buyer SDK, platform integrations) |
| 0.3 | 2026-03-14 | Srijan | Restructured to standard 17-section MVP template; added all required metadata |
| 0.4 | 2026-03-15 | Srijan | Added seller onboarding journeys (Journey A: Shopify, Journey B: API); Discovery & Distribution requirements (PRD.01.01.58–63); onboarding KPIs (PRD.01.08.11–13); acceptance criteria (PRD.01.06.25–32); glossary additions |
| 0.5 | 2026-03-15 | Srijan | Major strategy revision based on market research critique: founding layer positioning; two-door persona model (Agent Builder + API Developer); removed Shopify journey (obsoleted by Shopify Agentic Plan); removed Moltbook (acquired by Meta, wrong category); added Smithery/MCP Registry distribution; escrow deferred with two implementation paths; fiat rails added; competitive table updated; phase order flipped |

---

## 2. Executive Summary

**Key0 is the commercial foundation for AI agents.**

Start with Key0 and your agent is a business from day one — discoverable on every agent registry, payable by any AI system, and building a reputation with every transaction. Don't build payment infrastructure. Don't worry about discovery. Don't negotiate contracts. Write the part that matters: what your agent does.

The agent economy is already here. x402 processed 75M transactions and $24M in volume in the last 30 days alone (x402.org, March 2026). ChatGPT has live checkout. Shopify reports AI-driven orders up 15x year-over-year. Harvey AI has $100M ARR from AI-powered legal work. The bottleneck is no longer agent capability or buyer intent — it is that most APIs and agent services are not commercially accessible to other agents.

Key0 solves this in two ways:

**For agent builders** — `npx create-key0-agent` scaffolds a new agent project with the entire commercial layer pre-built: agent card, pricing plans, payment gate, registry listing, and reputation tracking. You build the logic; Key0 handles the business.

**For API developers** — three lines of configuration make any existing REST API instantly agent-payable. No changes to existing code, no impact on human customers, no new infrastructure to run.

The open-source SDK (`@key0ai/key0`) is the primary product surface for developers who want full control. The managed platform removes the need to operate storage backends for those who don't. Both use identical APIs.

**Revenue model:** Key0 charges a transaction fee (~2%) on payments processed through the platform. *(Note: exact fee collection mechanism for wallet-to-wallet transactions is an open question — see §6 Open Questions — and must be resolved before KPI targets in §5 are finalized.)*

The platform has two capability areas:

**Part 1 — Agent-Ready** describes what any seller needs to transact with AI agents: payment gating, agent card and discovery, and the full commerce lifecycle (quotes, async fulfillment, delivery verification, disputes, bilateral reputation).

**Part 2 — The Network** describes `registry.key0.ai` — a payment-enabled, programmatically-queryable agent service directory that fills a gap the A2A protocol specification explicitly acknowledges (GitHub Discussion #741) but has not yet defined.

---

## 3. Problem Statement

The agent economy is not approaching — it has arrived.

x402 processed **75 million transactions** and **$24M in volume** in the 30 days ending March 2026, across 94,000 buyers and 22,000 sellers (x402.org). ChatGPT launched live checkout in September 2025. Shopify reports AI-driven orders grew **15x** from January 2025 to January 2026. Harvey AI — an autonomous legal agent — has $100M ARR and is buying LexisNexis data feeds programmatically. AgentMail raised $6M in March 2026 specifically because hundreds of thousands of agents need identities to pay for services autonomously.

The gap is not agent capability. Agents exist, they have wallets, they have tasks to complete. **The gap is that the services they need to buy are not commercially accessible to them.**

Every API and agent service was built for human users: browser signups, OAuth consent screens, Stripe checkout flows. An agent running a task today hits these walls and either bounces (losing the seller revenue) or requires a human in the loop (breaking the autonomous workflow entirely).

**Key0 solves the seller side.** Any developer — whether they have an existing API or are building a new agent from scratch — can use Key0 to become commercially accessible to any AI agent with a wallet. Sellers define what they offer and at what price; Key0 handles everything else: the agent card, the payment gate, the registry listing, the order lifecycle, and the reputation system.

No changes to existing APIs. No impact on human customers. Agents get a structured, machine-readable commercial interface; existing users are unaffected.

### What "Agent-Ready" Means

An agent-ready seller can handle the full commerce lifecycle autonomously:

- The agent discovers what's for sale and at what price.
- The agent pays on-chain and receives a confirmation.
- The seller fulfills — instantly or asynchronously.
- The agent receives and verifies delivery.
- If something goes wrong, the agent can dispute without a human intermediary.
- For variable-priced work, the agent can request and accept a quote before paying.

### Market Context

AI agents are becoming autonomous economic actors. Platforms now provision agents with verifiable identity, on-chain wallets funded with USDC, payment credentials, and task execution autonomy across multi-step workflows.

Three forces converge making this the right moment:

1. **Protocol standardization**: A2A (v1.0, Linux Foundation, March 2026) and MCP are widely adopted. The interface for agent-facing APIs is now predictable.
2. **Payment rail readiness**: x402 with USDC on Base provides a native payment primitive agents can execute without card networks or invoicing.
3. **Platform growth**: Agent platforms are actively provisioning agents with spending credentials. The buyers exist; sellers need to be ready for them.

The gap between what sellers expose and what agents can consume is an active revenue loss. Sellers who are not agent-ready will lose this traffic to competitors who are.

### Competitive Gap

The relevant competitive set is agent-payment infrastructure, not traditional payment processors:

| Capability | Key0 | Nevermined | Fewsats | Kobaru / Foldset | Stripe Agent Toolkit |
|---|---|---|---|---|---|
| Payment gating (crypto) | Yes — x402/USDC | Yes | Yes | Yes | No |
| Payment gating (fiat) | Planned | Yes | Yes | Yes | Yes |
| A2A + MCP protocol support | Yes | Yes | MCP only | Partial | No |
| Quote / negotiation | Planned | No | No | No | No |
| Async fulfillment lifecycle | Planned | No | No | No | No |
| Delivery verification | Planned | No | No | No | No |
| Agent-facing dispute resolution | Planned | No | No | No | No |
| Bilateral reputation system | Planned | No | No | No | No |
| Payment-enabled discovery registry | Planned | No | No | No | No |
| `create-key0-agent` CLI scaffold | Planned | No | No | No | No |

Key0's moat is not the payment rail — competitors match or exceed on that. Key0's moat is the **full commerce lifecycle** (quotes → async fulfillment → delivery verification → disputes) combined with a **payment-enabled discovery registry** that fills the gap the A2A spec explicitly acknowledges.

---

## 4. Target Audience & User Personas

Key0 serves sellers — developers and teams who want to make their API or agent commercially accessible to other AI agents. There is no separate "buyer" persona: buyers are AI agents on the internet that interact with Key0-protected endpoints via standard x402 and A2A/MCP protocols. Key0 does not need to acquire buyers; it makes sellers findable and payable by the buyers that already exist.

---

### §4.1 For Agent Builders *(Primary — founding layer path)*

**Who:** A developer building a new AI agent that does something valuable — candidate screening, legal document review, competitive intelligence, market research, code testing, data enrichment. They want it to be a commercial product from day one, earning revenue from other AI systems that call it.

**Pain:** The agent logic is the interesting part. Everything around it — payment infrastructure, agent card spec, registry listing, delivery state machine, reputation — is undifferentiated work that takes weeks and still produces something worse than a purpose-built solution. Without it, the agent can't charge; it runs forever as a cost center.

**Success:** `npx create-key0-agent` scaffolds a project where the commercial identity is pre-built. The developer writes the function that does the work. Key0 handles the pricing, payment gate, agent card, registry listing, and reputation. The agent earns its first payment within a day of the first commit. Revenue grows with every agent that discovers it via `registry.key0.ai` and Smithery.

**Entry point:** `npx create-key0-agent` CLI

**Time to first earning agent:** < 1 day on a new project.

---

### §4.2 For API Developers *(Primary — retrofit path)*

**Who:** A developer or small team running a REST API — financial data feeds, domain intelligence, AI inference endpoints, proprietary datasets, niche analytics. They issue API keys today after human signup. They've seen traffic from something that looks like an agent hit their signup wall and drop off.

**Pain:** Agents can't complete signup forms, OAuth consent screens, or Stripe checkouts. The developer is either giving free access (hoping for conversion) or blocking the traffic entirely. Either way, revenue from agent traffic is zero regardless of volume.

**Success:** Three lines of configuration. Existing API untouched. Human customer flows unchanged. Agents can now discover the API on Smithery, pay per call, and receive credentials automatically — no human in the loop. Agent revenue starts immediately.

**Entry point:** `npm install @key0ai/key0` — mid-project integration

**Time to first agent payment:** < 1 hour on an existing API.

---

### §4.3 Non-Technical Service Sellers *(Tertiary — later, demand-signal driven)*

Small operators with a service to sell but no API or coding ability. Webhook adapter path via the managed dashboard. Not a launch priority — requires the seller ecosystem to mature and agent buyers to actively search for their service category first.

---

### Who Key0 Does Not Target

| Segment | Reason | Alternative |
|---|---|---|
| **Shopify sellers** | Shopify's own Agentic Plan ($0/month) connects their catalog to ChatGPT, Gemini, Copilot, and Perplexity with card checkout and normal bank payouts — a better deal on every dimension | Shopify Agentic Plan |
| **Large enterprise API providers** | Enterprise sales teams and procurement cycles; will not replace billing infrastructure with per-transaction x402; pull motion only if agent demand is proven | Existing enterprise contracts |
| **Consumer app developers** | Building for humans using AI chat; need Google UCP + OpenAI ACP + Shopify; traditional card payments | Google UCP, OpenAI ACP |
| **Physical goods sellers** | Agents primarily buy digital goods today; autonomous physical fulfillment is a 2028+ problem; escrow and fulfillment features required are deferred | Human commerce channels |

### Agent Identity Model (Tiered)

| Tier | Verification | Compatible With |
|---|---|---|
| A — Unverified | Self-asserted string. Logged, not verified. | Internal networks, development |
| B — OAuth-verified | `sub`/`client_id` from a validated OAuth 2.1 Bearer token | A2A, MCP, all enterprise agent platforms |
| C — DID-verified | `did:web:` URI; Key0 issues a nonce, buyer signs with DID key, Key0 verifies | Open-internet agents, maximum assurance |

The wallet address and OAuth sub together form a compound identity sufficient for commerce: the wallet proves "I paid," the OAuth token proves "I am who I claim to be."

---

## 5. Success Metrics (KPIs)

| ID | KPI | Target |
|---|---|---|
| `PRD.01.08.01` | Seller onboarding | First agent payment received in < 30 minutes from account creation |
| `PRD.01.08.02` | Order acknowledgment | < 500ms for `submit-order` |
| `PRD.01.08.03` | Delivery notification | Agent notified within 30 seconds of seller marking delivery complete |
| `PRD.01.08.04` | SLA enforcement | Order transitions to `OVERDUE` within 60 seconds of SLA breach |
| `PRD.01.08.05` | Backward compatibility | Zero breaking changes to existing seller contracts |
| `PRD.01.08.06` | Protocol coverage | All capabilities available as both A2A skills and MCP tools |
| `PRD.01.08.07` | Registry search latency | Results returned within 200ms p99 |
| `PRD.01.08.08` | Reputation propagation | Seller/buyer scores updated within 60 minutes of order finalization |
| `PRD.01.08.09` | Escrow release | Funds released within 60 seconds of `confirm-delivery` or auto-confirm *(deferred — applies post-escrow-launch only)* |
| `PRD.01.08.10` | Dispute acknowledgment | `file-dispute` returns dispute record within 500ms |
| `PRD.01.08.11` | Agent builder time-to-first-payment | < 24 hours from `npx create-key0-agent` to first agent payment received |
| `PRD.01.08.12` | API developer time-to-first-payment | < 1 hour from `npm install` to first agent payment received |
| `PRD.01.08.13` | Registry distribution | Seller listed on Smithery and official MCP Registry within 60 seconds of Key0 registration |

---

## 6. Scope & Requirements

### In Scope

**Part 1 — Agent-Ready** (core platform):
- Negotiation: `request-quote`, `accept-quote` with binding TTL and rate limiting
- Transaction: x402/USDC payment flow, `submit-order` returning order + challenge, escrow mode, fiat rail abstraction, full audit logging
- Fulfillment: order state machine, webhook delivery, SLA enforcement, `cancel-order`
- Verification: `confirm-delivery`, `reject-delivery`, auto-confirm timeout, signed commerce receipts
- Dispute: `file-dispute`, `get-dispute-status`, pluggable arbitration, auto-escalation
- No-code onboarding: Shopify app (first connector), generic webhook adapter
- Seller dashboard: service configuration, order management, dispute handling, revenue reporting, event stream

**Part 2 — The Network**:
- Discovery registry at `registry.key0.ai`: capability search, reputation scores, quote comparison
- Bilateral reputation: per-seller and per-buyer metrics, immutable audit entries, minimum threshold enforcement
- Buyer SDK (`@key0ai/client`): full commerce lifecycle client for agent developers
- Platform integrations: OAuth token passthrough, wallet compatibility, registry delegation

### Out of Scope

See Section 11 (Constraints & Assumptions) for the full non-goals list.

---

## 7. User Stories & User Roles

### Roles

| Role | Description |
|---|---|
| Agent Builder | Developer building a new AI agent intended to earn revenue from other agents |
| API Developer | Developer with an existing REST API wanting to accept agent payments |
| Task Seller | Agent builder / API developer providing variable-priced services requiring negotiation |
| Digital Goods Vendor | Agent builder / API developer selling asynchronously-fulfilled digital deliverables |
| Platform Operator | Agent platform integrating Key0 as native commerce layer |

### User Stories

**`PRD.01.09.01`** As a **Task Seller**, I want to receive a job description, return a binding price quote with a TTL, and proceed to payment only if the agent accepts, so that I can handle variable-priced work without fixed plan pricing.

**`PRD.01.09.02`** As a **Digital Goods Vendor**, I want to accept payment for a research report and fulfill it asynchronously, so that agents can purchase long-running deliverables.

**`PRD.01.09.03`** As an **Agent Builder**, I want to run a single CLI command that scaffolds a new agent project with payment gating, an agent card, and registry listing already configured, so that my agent is commercially accessible from the first deployment.

**`PRD.01.09.04`** As an **API Developer**, I want to add three lines of configuration to my existing API so that AI agents can discover, pay, and receive credentials — without any changes to my existing code or human-customer flows.

**`PRD.01.09.05`** As a **Task Seller**, I want to dispute a non-delivery so that my reputation score is not penalized when an agent files a false dispute.

**`PRD.01.09.06`** As an **Agent Builder**, I want all my capabilities available as both A2A skills and MCP tools with identical typed schemas, so that any agent on any platform can call me regardless of their framework.

**`PRD.01.09.07`** As a **Platform Operator**, I want to integrate Key0 using my existing OAuth infrastructure and wallet layer, so that every agent on my platform gains commerce capabilities without per-agent configuration.

### Seller Onboarding Journeys

The following narratives describe the step-by-step experience for the two primary seller archetypes. These are product walkthroughs, not requirement lists — the measurable criteria are in §8 and §14.

---

#### Journey A: The Agent Builder (e.g. a solo developer building a research agent)

**Who:** A developer building a new AI agent that performs valuable work — market research, candidate scoring, legal document review, competitive intelligence. They want it to earn revenue from other AI agents from day one.

**Entry point:** `npx create-key0-agent` — one command starts the project.

**Steps:**

1. **Scaffold** — The CLI prompts for: agent name, what it does (description), framework (Express/Hono/Fastify/MCP), plans (name + price), wallet address, network (mainnet/testnet). Generates a fully configured project in under 60 seconds.

2. **Write the logic** — The scaffolded project has one function stub: `fetchResourceCredentials`. This is where the developer writes what their agent actually does — process an input, run inference, fetch data, return a result. Everything else is pre-built.

3. **Deploy** — Standard deployment to any Node/Bun host. On first run, Key0 automatically registers the agent card on `registry.key0.ai` and pushes the listing to Smithery and the official MCP Registry.

4. **When an agent calls:**
   - Calling agent receives an HTTP 402 with payment instructions.
   - Pays via x402 (USDC on Base) or other supported payment instrument.
   - Key0 verifies payment, calls `fetchResourceCredentials`, returns the result.
   - For async work: order enters `PROCESSING` state; agent polls or receives webhook on completion.
   - Payment lands in the developer's wallet automatically.

**What the agent builder has at the end:**
- An autonomous agent that earns money from every successful call.
- A live listing on `registry.key0.ai`, Smithery, and the official MCP Registry — discoverable by any agent developer searching for the capability.
- A reputation score that builds with every completed transaction.
- Zero payment infrastructure to maintain.

**Time from `npx create-key0-agent` to first earning agent: < 1 day.**

---

#### Journey B: The API Developer (e.g. nyne.ai, tinyfish.ai)

**Who:** A technical team or solo developer running a REST API. Currently issues API keys to humans after a signup flow. Wants to accept payment from AI agents that cannot complete that flow.

**Entry point:** `key0.ai/sellers` or `npm install @key0ai/key0` — either the dashboard or the SDK.

**Path 1 — Managed SaaS (no code, dashboard-only):**

1. **Sign up** — Email + password, or OAuth with GitHub/Google. (No Shopify dependency — this is a separate auth path.)

2. **Create a Plan** — In the dashboard, define what they sell:
   - Plan name (e.g. "API Access — 1,000 requests")
   - Price in USD (Key0 shows USDC equivalent)
   - Description of what the buyer gets

3. **Configure the Credential Callback** — Paste a webhook URL that Key0 will POST to after payment, expecting back a credential (API key, JWT, etc.). Key0 provides a test harness to verify the webhook before going live.

4. **Set wallet address** — Same as Journey A.

5. **Go Live** — Key0 generates the agent card and registers it on the discovery registry. Optionally submit to external agent networks.

**Path 2 — Self-hosted SDK (three lines of code):**

```typescript
import { createKey0 } from "@key0ai/key0";
import { createExpressIntegration } from "@key0ai/key0/express";

const { requestHandler, agentCard } = createKey0({
  walletAddress: "0x...",
  network: "mainnet",
  plans: [{ planId: "standard", unitAmount: "$0.05" }],
  fetchResourceCredentials: async () => ({ apiKey: issueApiKey() }),
});
```

Mount on their existing Express/Hono/Fastify app. Deploy as they normally would. Done.

6. **Register on the network (optional but recommended):**
   - Run `key0 register` CLI command (or one-click in dashboard) to push the self-hosted agent card to `registry.key0.ai`.
   - Key0 validates the endpoint is reachable, then lists it.

7. **Discovery distribution** — After registration, Key0 automatically propagates the listing to:
   - `registry.key0.ai` (Key0's own directory)
   - External agent networks that have an open API (Moltbook and equivalents)
   - The `.well-known/agent-card.json` endpoint on their own domain (Key0 provides DNS guidance)

**What the API seller has at the end:**
- Any AI agent on any A2A- or MCP-compatible platform can discover their API, pay, and receive credentials — fully autonomous, no human in the loop.
- USDC lands directly in their wallet per transaction — no invoicing, no NET-30, no Stripe disputes.
- A reputation score on the Key0 registry that builds over time, making their listing rank higher.
- Presence on all opted-in agent discovery networks without any additional integration work.
- Zero changes to their existing API or human-facing product.

**Time from starting sign-up to first agent-payable endpoint: < 30 minutes (dashboard path) or < 10 minutes (SDK path with existing API).**

---

## 8. Functional Requirements

### Negotiation

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.01` | `request-quote` accepts a job description and returns a binding quote | Quote includes amount, currency, expiry, and description |
| `PRD.01.01.02` | Quote TTL enforced server-side | Expired quotes rejected regardless of client-supplied timestamps; ≤ 30 seconds clock skew tolerance |
| `PRD.01.01.03` | Accepted quotes are single-use | Second acceptance returns `QUOTE_ALREADY_ACCEPTED` |
| `PRD.01.01.04` | `accept-quote` returns a payment challenge using the exact quoted amount | Amount is exact; no rounding |
| `PRD.01.01.05` | Sellers declare negotiation support in their agent card | Agents can check before requesting; unsupported sellers return `NEGOTIATION_NOT_SUPPORTED` |
| `PRD.01.01.06` | `request-quote` is rate-limited per buyer identity | Max 10 requests per buyer per seller per hour; excess returns `RATE_LIMIT_EXCEEDED` |

### Transaction

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.07` | Existing x402 challenge-proof flow unchanged | All existing seller contracts, challenges, and access grants work without modification |
| `PRD.01.01.08` | `submit-order` creates the order and issues a payment challenge in a single response | Order is not in a payable state until the challenge is returned; no separate prior `request-access` call needed |
| `PRD.01.01.09` | Escrow mode holds funds until delivery confirmation *(deferred post-launch — implementation via audited smart contract or licensed money transmitter partner only; Key0 does not hold funds directly)* | Funds are not moved to the seller wallet until `confirm-delivery` or auto-confirm timeout |
| `PRD.01.01.10` | Payment rail abstraction supports fiat as well as crypto *(planned — USDC/x402 ships first; Stripe/fiat adapter follows; MSB/FinCEN legal review required before any fiat adapter ships)* | A Stripe fiat adapter can be substituted for plans that declare a fiat payment rail |
| `PRD.01.01.11` | All payment events logged to the audit store | Every state transition has an immutable audit entry |

### Fulfillment

State machine:
```
PENDING → PROCESSING → READY → DELIVERED
                             ↘ DELIVERY_REJECTED → DISPUTED
         → OVERDUE → DISPUTED
         → CANCELLED
```

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.12` | `get-order-status` returns current state and full history | State history includes timestamps for every transition; response within 200ms |
| `PRD.01.01.13` | Webhook delivery on status change | If a callback URL is registered, a POST is sent within 30 seconds; retried on failure with exponential backoff |
| `PRD.01.01.14` | Seller SLA triggers `OVERDUE` automatically | Transition happens within 60 seconds of SLA expiry; buyer can file dispute immediately |
| `PRD.01.01.15` | `cancel-order` accepted before fulfillment begins; rejected after | Rejection includes current state |
| `PRD.01.01.16` | Callback URLs validated at order creation | Private IPs, loopback, link-local, and non-HTTPS rejected with `INVALID_CALLBACK_URL` |
| `PRD.01.01.17` | Seller delivery endpoint is authenticated | The endpoint the seller calls to mark an order ready requires the seller's own credentials; unauthenticated calls are rejected |

### Verification

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.18` | `confirm-delivery` transitions order to `DELIVERED` and triggers escrow release | Release within 60 seconds |
| `PRD.01.01.19` | `reject-delivery` transitions order to `DELIVERY_REJECTED` with a reason | Reason stored on the order and included in any subsequent dispute |
| `PRD.01.01.20` | Auto-confirm timeout releases escrow to seller if buyer is unresponsive | Configurable (default 72 hours); atomic and logged |
| `PRD.01.01.21` | Delivery actions are idempotent | Calling twice returns existing state without side effects |
| `PRD.01.01.22` | Delivery payload stored on the order | Accessible via `get-order-status` after the seller marks ready |

### Signed Commerce Receipts

Every completed order generates a structured, cryptographically-signed receipt — signed by Key0 — that the agent can store, present as proof of purchase, or share with third parties. The receipt is machine-verifiable without trusting Key0 directly: the signature can be checked against Key0's published public key. The receipt covers the full chain: who paid, how much, to whom, what was delivered, and when.

### Dispute

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.23` | `file-dispute` accepts a reason and optional evidence | Returns dispute record with seller response deadline within 500ms |
| `PRD.01.01.24` | Supported reason codes | Non-delivery, SLA breach, wrong item, quality issue, unauthorized charge |
| `PRD.01.01.25` | Seller must respond within deadline | Auto-escalates to arbitration if seller does not respond |
| `PRD.01.01.26` | `get-dispute-status` returns current state and full timeline | All transitions and resolution details included |
| `PRD.01.01.27` | Resolution triggers escrow release to winning party | Refund to buyer or release to seller within 60 seconds |
| `PRD.01.01.28` | Arbitration mechanism is pluggable | Interface defined; specific backend is configurable |

### CLI Scaffold & Developer Onboarding

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.29` | `npx create-key0-agent` CLI scaffolds a new agent project | Running the CLI produces a deployable project in < 60 seconds; project includes agent card config, payment gate, and registry registration wired at startup |
| `PRD.01.01.30` | CLI prompts for all required config | Prompts cover: agent name, description, framework (Express/Hono/Fastify/MCP), plans (planId + price), wallet address, network; no manual file editing required |
| `PRD.01.01.31` | Scaffolded project registers on first run | On `npm run start`, agent card is live at `registry.key0.ai` and listed on Smithery within 60 seconds |
| `PRD.01.01.32` | One-click migration from self-hosted SDK to managed platform | Existing `createKey0()` config can be migrated to managed platform by adding a Key0 API key — no code changes required |

### Discovery Registry

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.33` | Sellers register their agent card | Registration returns a registry ID within 1 second |
| `PRD.01.01.34` | Registry supports capability keyword search | Results returned within 200ms p99 |
| `PRD.01.01.35` | Registry returns seller reputation score alongside listing | Score reflects completion rate, dispute rate, and delivery SLA adherence |
| `PRD.01.01.36` | Agent card schema extended with service type, delivery method, and SLA fields | All new fields optional; existing agent cards remain valid |
| `PRD.01.01.37` | Sellers update listings without re-registering | Old listing replaced atomically |
| `PRD.01.01.38` | Registry is self-hostable | No dependency on the hosted registry for private deployments |
| `PRD.01.01.39` | Registration is rate-limited | Max 10 attempts per IP per hour; max 3 listings per verified identity without a staking deposit |

### Reputation

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.40` | Registry stores per-seller metrics | Order count, completion rate, dispute rate, average delivery vs. declared SLA |
| `PRD.01.01.41` | Seller score updated on every order finalization | Propagates to registry within 60 minutes |
| `PRD.01.01.42` | Score formula documented and deterministic | Same inputs always produce the same output; formula is published |
| `PRD.01.01.43` | Seller records are immutable | Audit store entries are write-only; no delete or update on history |
| `PRD.01.01.44` | Registry search sortable by seller reputation | Agents can rank results by reliability |
| `PRD.01.01.45` | Registry stores per-buyer metrics | Order count, dispute rate (disputes filed / orders placed), confirmation rate (confirmed / delivered), cancellation rate |
| `PRD.01.01.46` | Buyer score updated on every order finalization | Propagates within 60 minutes |
| `PRD.01.01.47` | Buyer reputation tied to verified identity | Tier A buyers have no reputation. Tier B/C buyers accumulate reputation against their OAuth sub or DID |
| `PRD.01.01.48` | Sellers can set a minimum buyer reputation threshold | Orders from buyers below the threshold rejected with `BUYER_REPUTATION_INSUFFICIENT` |
| `PRD.01.01.49` | Buyers cannot alter their own reputation records | Score and aggregate metrics readable; underlying audit entries not modifiable |

### Buyer SDK

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.50` | `@key0ai/client` wraps full commerce lifecycle | Exposes: `search`, `requestQuote`, `acceptQuote`, `waitForDelivery`, `confirmDelivery`, `fileDispute` |
| `PRD.01.01.51` | Package is independent of seller SDK | Sellers must not need to install buyer dependencies |
| `PRD.01.01.52` | All capabilities available via A2A skills and MCP tools | Identical typed input/output schemas across both protocols |

### Platform Integrations

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.53` | OAuth token passthrough | Platform agent OAuth tokens accepted as Tier B identity |
| `PRD.01.01.54` | Wallet compatibility | Platform wallet infrastructure must sign and submit USDC transfers on Base (x402 compatible) |
| `PRD.01.01.55` | Registry delegation | Platform can optionally expose a curated view of the Key0 registry |

### Seller Dashboard

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.56` | Dashboard is itself an agent | Seller dashboard exposes a seller-facing MCP server and A2A agent for account management |
| `PRD.01.01.57` | Observability event stream | Every significant event surfaced in dashboard and exportable to external stacks (Datadog, Grafana, CloudWatch) |

### Discovery & Distribution

| ID | Requirement | Measurable Criterion |
|---|---|---|
| `PRD.01.01.58` | Auto-register on Key0 registry on first deployment | Agent card live at `registry.key0.ai` within 60 seconds of first server start |
| `PRD.01.01.59` | Auto-list on Smithery and official MCP Registry | Key0 pushes agent card to Smithery (`registry.smithery.ai`) and official MCP Registry (`registry.modelcontextprotocol.io`) within 60 seconds of Key0 registration; seller sees per-registry confirmation in dashboard |
| `PRD.01.01.60` | Agent card hosted at a stable public URL | `key0.ai/s/{seller-id}/agent-card.json` always serves the latest agent card; URL never changes after registration |
| `PRD.01.01.61` | `.well-known/agent-card.json` guidance for self-hosted sellers | Key0 dashboard generates a ready-to-deploy nginx/Caddy snippet for hosting `/.well-known/agent-card.json` on a custom domain |
| `PRD.01.01.62` | Registry distribution status visible in dashboard | Seller can see per-registry status: pending / live / failed for `registry.key0.ai`, Smithery, and official MCP Registry |

---

## 9. Quality Attributes

### Performance

| ID | Attribute | Target |
|---|---|---|
| `PRD.01.02.01` | `submit-order` response latency | < 500ms p99 |
| `PRD.01.02.02` | `get-order-status` response latency | < 200ms p99 |
| `PRD.01.02.03` | Registry search latency | < 200ms p99 |
| `PRD.01.02.04` | Delivery webhook dispatch | Within 30 seconds of seller marking delivery complete |
| `PRD.01.02.05` | OVERDUE transition latency | Within 60 seconds of SLA expiry |
| `PRD.01.02.06` | Escrow release latency | Within 60 seconds of `confirm-delivery` or resolution |
| `PRD.01.02.07` | `file-dispute` response latency | Within 500ms |

### Availability

| ID | Attribute | Target |
|---|---|---|
| `PRD.01.02.08` | Payment-path availability | Registry is advisory and not in the critical payment path; sellers retain self-hosted agent cards as fallback |
| `PRD.01.02.09` | Registry availability | CDN-cache search results; outage must not block ongoing payments |

### Security

| ID | Attribute | Target |
|---|---|---|
| `PRD.01.02.10` | SSRF prevention | Callback URLs validated at order creation — private IPs, loopback, link-local, and non-HTTPS rejected in production |
| `PRD.01.02.11` | Authenticated delivery endpoint | Unauthenticated seller delivery endpoint calls rejected |
| `PRD.01.02.12` | Double-spend prevention | Transaction hash idempotency check via atomic SET NX; second submission returns `TX_ALREADY_REDEEMED` |
| `PRD.01.02.13` | Atomic state transitions | All order/challenge/quote/dispute transitions use compare-and-swap; no direct writes |

### Backward Compatibility

| ID | Attribute | Target |
|---|---|---|
| `PRD.01.02.14` | Existing seller contract stability | Zero breaking changes to any existing seller contract, challenge format, or access grant |

---

## 10. Architecture Requirements

@diagram: c4-l2
<!--
  intent: System context diagram for Key0 Platform
  scope: Key0 SaaS — seller infrastructure for agent commerce
  actors: Agent Buyer, Seller (API/Digital/Physical/Shopify), Key0 Platform, Base blockchain, External Agent Platforms, Registry
  focus: System boundary, major integrations, payment rail (x402/USDC), webhook callbacks, A2A/MCP protocol surface
-->

@diagram: dfd-l1
<!--
  intent: Level-1 data flow through Key0 Platform
  scope: Agent buyer → Key0 → Seller fulfillment
  flows:
    - Agent submits order → Key0 creates challenge → Agent submits payment proof → Key0 verifies on-chain → Order confirmed → Seller webhook → Seller marks ready → Agent confirms delivery → Escrow released
    - Dispute path: Agent rejects delivery → dispute filed → arbitration → resolution → escrow released to winning party
  data stores: ChallengeStore, OrderStore, SeenTxStore, AuditStore, ReputationStore
-->

@diagram: sequence-payment-flow
<!--
  intent: x402 payment and order lifecycle sequence
  participants: Agent, Key0 API, Base Chain, Seller Webhook
  happy-path:
    Agent → Key0: submit-order(planId, jobDescription?)
    Key0 → Agent: { order, challenge }
    Agent → Base Chain: transfer USDC
    Agent → Key0: submit proof(txHash)
    Key0 → Base Chain: verify ERC-20 Transfer event
    Base Chain → Key0: confirmed
    Key0 → Seller Webhook: order confirmed callback
    Key0 → Agent: order confirmed
  alt payment proof invalid:
    Key0 → Agent: error TX_INVALID
  else challenge expired:
    Key0 → Agent: error CHALLENGE_EXPIRED
  alt seller SLA breached:
    Key0 → Agent: order status OVERDUE (auto-transition)
    Agent → Key0: file-dispute
-->

### Architecture Topics

| ID | Topic | Decision |
|---|---|---|
| `PRD.01.32.01` | Backward compatibility | Every seller using Key0 today upgrades to any new version without changing a line of configuration or code. New capabilities added through optional config fields only. |
| `PRD.01.32.02` | One-flow payment+order | `submit-order` creates the order and issues the payment challenge in a single response. No two-step "get challenge then create order" flow. |
| `PRD.01.32.03` | State machines as source of truth | Every entity (challenges, orders, quotes, disputes) has a defined state machine. Transitions are atomic and enforced at the storage layer. No direct writes. |
| `PRD.01.32.04` | Agent identity: integrate, don't build | Key0 does not build or own agent identity infrastructure. Integrates with OAuth 2.1, W3C DID, SPIFFE/SPIRE, and Verifiable Credentials as the ecosystem matures. |
| `PRD.01.32.05` | Seller dashboard is itself an agent | Dashboard exposes a seller-facing MCP server and A2A agent for account management. Dogfoods the product. |
| `PRD.01.32.06` | Managed by default, open-source for power users | Primary product is managed SaaS. Open-source self-hosted SDK is functionally identical and remains available. |

---

## 11. Constraints & Assumptions

### Constraints (Non-Goals)

1. **No subscription / recurring billing** — Key0 is per-transaction. No subscription management, billing cycles, or seat licensing.
2. **No proprietary agent identity infrastructure** — No agent identity registry, credential issuance, or DID method. Key0 integrates with ecosystem standards.
3. **No agent hosting or execution** — Key0 is infrastructure that agents call into. It does not run agents.
4. **No multi-party payment splitting** — Payments go to a single seller wallet per order.
5. **No content moderation of seller listings** — Key0 does not review seller product descriptions beyond schema validation.
6. **No order fulfillment execution** — Key0 provides the state machine and callbacks, not the actual fulfillment logic.
7. **No buyer wallet custody** — Key0 does not hold or manage buyer wallets.
8. **No cross-chain payments at launch** — Only Base mainnet (chainId 8453) and Base Sepolia (chainId 84532) are supported at launch. Multi-chain support is a later phase.
9. **No KYC / real-world identity verification** — Reputation is computed from on-chain and in-system behavior only.
10. **Escrow deferred post-launch** — Escrow requires either an audited on-chain smart contract or a licensed money transmitter partnership (Stripe, Coinbase). Key0 does not hold funds directly under any scenario. Legal counsel engagement required before escrow ships.
11. **Fiat payment adapters require legal review** — Adding any fiat payment rail (e.g. Stripe adapter) requires MSB/FinCEN legal analysis before shipping. USDC/x402 ships at launch; fiat adapters are planned but gated on legal clearance.

### Assumptions

1. A2A v1.0 (Linux Foundation) and MCP protocol interfaces are stable for the duration of this development cycle.
2. USDC on Base remains liquid and available as the primary payment rail.
3. Sellers implement the required callbacks (e.g., `fetchResourceCredentials`, fulfillment webhook) correctly.
4. Base blockchain RPC nodes are available and responsive within acceptable latency for on-chain verification.
5. The open-source SDK (`@key0ai/key0`) continues to serve as the reference implementation for the managed platform.
6. Escrow begins as an internal ledger hold; an on-chain smart contract adapter is a later opt-in once formally audited.

---

## 12. Risk Assessment

### Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `PRD.01.07.01` | **Escrow smart contract vulnerability** — bug in on-chain escrow causes irreversible fund loss | Medium | Critical | Formal audit before any on-chain escrow deployment. Start with trust-based (internal ledger) escrow. On-chain escrow as opt-in only after audit. |
| `PRD.01.07.02` | **Registry spam / Sybil listings** — bad actors create fake seller listings | High | High | Rate-limit registration. Small refundable USDC staking deposit to list. Auto-flag listings with zero orders after 30 days. |
| `PRD.01.07.03` | **Quote flooding / DoS** — agents spam `request-quote` at high volume | Medium | Medium | Rate-limit `request-quote` per buyer identity (max 10/hour/seller). Optional deposit requirement before quote is generated. |
| `PRD.01.07.04` | **Concurrent state transitions** — two simultaneous `confirm-delivery` calls for the same order | Low | High | All transitions use the same atomic compare-and-swap pattern as the existing challenge engine. |
| `PRD.01.07.05` | **Webhook delivery failures** — buyer's callback URL is unreachable | Medium | Medium | Retry with exponential backoff. `get-order-status` is the reliable source of truth; callback URL is best-effort. |
| `PRD.01.07.06` | **SSRF via callback URL** — buyer provides a URL pointing at internal infrastructure | High | Critical | Validate callback URLs at order creation. Block private IPs, loopback, link-local, and non-HTTPS in production. |
| `PRD.01.07.07` | **Unauthenticated seller delivery endpoint** — anyone who knows an order ID marks it delivered | Medium | High | Delivery endpoint requires the seller's bearer token. Unauthenticated calls rejected. |
| `PRD.01.07.08` | **Arbitration neutrality** — Key0-operated arbitration is perceived as biased | Medium | High | Default to neutral third-party arbitration. Key0-hosted arbitration only as a fallback. Backend is pluggable. |
| `PRD.01.07.09` | **Registry availability** — outage blocks discovery | Low | High | CDN-cache search results. Sellers retain self-hosted agent cards as fallback. Registry is advisory, not in the payment path. |

### Go-to-Market Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `PRD.01.07.10` | **Agent buyer ecosystem too small early** — not enough agent traffic to prove seller ROI | High | High | Target API Operators first (existing technical Key0 users). Build pull from agent platforms directly. Developer evangelism before no-code onboarding. |
| `PRD.01.07.11` | **Competing commerce-for-agents product ships first** | Medium | High | x402/USDC rail and on-chain verifiability are defensible differentiators. Maintain protocol agnosticism (A2A + MCP). |
| `PRD.01.07.12` | **Regulatory uncertainty** — USDC transfers trigger MSB requirements | Low | High | Key0 does not custody funds — payments flow directly between buyer and seller wallets. Engage legal counsel before adding escrow custody. |
| `PRD.01.07.13` | **No-code adoption below target** | Medium | Medium | Launch with one high-fit vertical (digital goods on Shopify) before broader rollout. |

---

## 13. Implementation Approach

> **Status**: Stub — engineering input required to complete this section.

> **Phase ordering is customer-driven.** The sequence below reflects the beachhead strategy — converting existing `@key0ai/key0` SDK users — but phases 2+ should be re-ordered based on what the first paying customer cohort actually needs.

### Phase 1 — Managed Platform, CLI, and Registry *(beachhead)*

Convert existing SDK users to the managed platform and make every seller immediately discoverable:

- `npx create-key0-agent` CLI: prompts, scaffolds, deploys a new agent project with commercial identity pre-built
- Managed platform: hosted storage (Redis/Postgres) so sellers don't run infrastructure
- One-click migration: `createKey0()` config → managed platform via API key, no code changes
- Auto-registration: agent card live at `registry.key0.ai` on first deployment
- Auto-listing: push to Smithery (`registry.smithery.ai`) and official MCP Registry within 60 seconds of registration
- Dashboard: per-registry distribution status, order history, revenue, reputation score

Builds on: existing `challenge-engine.ts`, `storage/`, `access-token.ts`, `agent-card.ts`, x402 adapter.

### Phase 2 — Core Order Lifecycle *(when first async-service customer requires it)*

- Order state machine (`PENDING → PROCESSING → READY → DELIVERED / DELIVERY_REJECTED / OVERDUE / CANCELLED`)
- `submit-order` returning `{ order, challenge }` in a single response
- Webhook delivery with exponential backoff retry
- SLA enforcement timer (auto-`OVERDUE` transition)
- `confirm-delivery` / `reject-delivery` + auto-confirm timeout
- Signed commerce receipts

### Phase 3 — Negotiation *(when first variable-priced service customer requires it)*

- Quote engine: `request-quote`, `accept-quote`, quote TTL enforcement, single-use constraint, rate limiting per buyer identity
- Quote state machine integrated with existing challenge lifecycle

### Phase 4 — Dispute *(when dispute volume justifies it)*

- Dispute filing, status, seller response deadline
- Auto-escalation on seller non-response
- Pluggable arbitration interface (initial implementation: Key0-hosted manual review; neutral third-party on escalation)

### Phase 5 — Network Maturation

- Bilateral reputation engine: per-seller scores, deterministic formula, 60-minute propagation
- Buyer SDK (`@key0ai/client`): composable typed client wrapping full lifecycle
- `registry.key0.ai` search: capability keyword search, reputation sorting, quote comparison brokering
- Platform integration: OAuth passthrough, wallet compatibility docs, registry delegation

### Phase 6 — Fiat Payment Adapters *(post legal review)*

- Stripe adapter for fiat-denominated plans
- MSB/FinCEN legal clearance required before shipping
- Gated on legal counsel sign-off

### Phase 7 — Escrow *(post legal review, deferred)*

- Implementation via audited on-chain smart contract (Path A) or licensed money transmitter partnership (Path B)
- Key0 does not hold funds directly under any scenario
- Legal trigger: engage counsel when escrow demand is validated by customer requests

### Phase 8 — Non-Technical Seller Onboarding *(demand-signal driven)*

- Generic webhook adapter for sellers without an API
- No Shopify-specific connector at launch (Shopify Agentic Plan serves that segment)
- WooCommerce/WhatsApp connectors: deferred by demand signal

### Open Questions (Engineering)

1. **OQ-1: Fee Collection Mechanism** *(blocker for business model)* — How does Key0 collect its ~2% transaction fee on wallet-to-wallet USDC transactions? Options: route through a Key0 fee address; collect via facilitator layer; bill separately. Must be resolved before §5 KPIs are finalized.
2. **OQ-2: Registry Governance** — Open listing with USDC staking deposit to prevent spam. Auto-flag zero-order listings after 30 days.
3. **OQ-3: Dispute Arbitration Provider** — Pluggable interface; initial: Key0-hosted manual. Neutral third-party (e.g., Kleros) on escalation based on volume.
4. **OQ-4: Buyer SDK Packaging** — Separate `@key0ai/client`; shared types in `@key0ai/types`. Consider whether `@key0ai/client` should itself be an MCP server for maximum orchestrator compatibility.
5. **OQ-5: Smithery Integration Mechanism** — Manual submission to Smithery registry or programmatic push via Smithery's registry API (`registry.smithery.ai`).

---

## 14. Acceptance Criteria

### Global Agent Buyer Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.01` | All seller-facing capabilities are available as both A2A skills and MCP tools with identical typed input/output schemas. |
| `PRD.01.06.02` | `submit-order` returns an order record and a payment challenge in a single response — one flow, not two. |
| `PRD.01.06.03` | `cancel-order` before fulfillment begins returns buyer funds within the refund SLA (default 24 hours; maximum 72 hours). |
| `PRD.01.06.04` | `file-dispute` returns a dispute record with a seller response deadline within 500ms. |
| `PRD.01.06.05` | All responses include a request ID echo and support idempotent retry — the same request ID submitted twice returns the same response without creating duplicate records. |
| `PRD.01.06.06` | Registry search returns structured results within 200ms p99. |

### Negotiation Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.07` | `request-quote` returns a quote with a unique ID, amount, and expiry within 5 seconds. |
| `PRD.01.06.08` | A quote past its expiry is rejected server-side with `QUOTE_EXPIRED`. |
| `PRD.01.06.09` | `accept-quote` returns a payment challenge using the exact quoted amount. |
| `PRD.01.06.10` | A quote accepted once cannot be accepted again (`QUOTE_ALREADY_ACCEPTED`). |
| `PRD.01.06.11` | Expired quotes leave no payment records or obligations. |

### Transaction Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.12` | `submit-order` returns `{ order, challenge }` within 500ms. |
| `PRD.01.06.13` | The same transaction hash submitted twice returns `TX_ALREADY_REDEEMED` on the second attempt. |

### Verification Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.14` | *(Deferred — escrow post-launch)* Escrow holds on payment; releases to seller on `confirm-delivery` within 60 seconds. |
| `PRD.01.06.15` | *(Deferred — escrow post-launch)* `reject-delivery` within the buyer rejection window initiates a refund. |
| `PRD.01.06.16` | *(Deferred — escrow post-launch)* Auto-confirm releases escrow if no response within the configured window (default 72 hours). |
| `PRD.01.06.17` | Physical orders surface a tracking identifier and carrier in order status. |

### Dispute Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.18` | `file-dispute` returns a dispute ID and seller response deadline within 500ms. |
| `PRD.01.06.19` | Non-response by the seller deadline auto-escalates the dispute. |
| `PRD.01.06.20` | Resolution triggers escrow release within 60 seconds. |

### CLI & Developer Onboarding Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.21` | `npx create-key0-agent` scaffolds a deployable project in < 60 seconds with no manual file editing required. |
| `PRD.01.06.22` | Scaffolded project registers on `registry.key0.ai` and lists on Smithery within 60 seconds of first `npm run start`. |
| `PRD.01.06.23` | Agent builder has a live, payable agent endpoint within 1 day of running `npx create-key0-agent`. |
| `PRD.01.06.24` | API developer has a live, payable endpoint within 1 hour of running `npm install @key0ai/key0`. |

### Seller Onboarding Journey Acceptance Criteria

| ID | Criterion |
|---|---|
| `PRD.01.06.25` | One-click migration from self-hosted SDK to managed platform completes without code changes — only an API key is required. |
| `PRD.01.06.26` | Migrated self-hosted seller has registry listing on `registry.key0.ai` and Smithery within 60 seconds of migration. |
| `PRD.01.06.27` | Agent card is registered on `registry.key0.ai` within 60 seconds of first deployment or wizard completion. |
| `PRD.01.06.28` | Smithery and official MCP Registry listings are confirmed within 60 seconds of `registry.key0.ai` registration. |
| `PRD.01.06.29` | API seller using the managed dashboard path has a payable endpoint within 30 minutes of sign-up. |
| `PRD.01.06.30` | API seller using the SDK path has a payable endpoint within 10 minutes of running `npm install`. |
| `PRD.01.06.31` | Dashboard shows per-registry distribution status (pending / live / failed) for `registry.key0.ai`, Smithery, and official MCP Registry. |
| `PRD.01.06.32` | Seller dashboard shows agent discovery impressions (views of their agent card on the registry) and conversion (orders / impressions). |

---

## 15. Budget & Resources

> **Status**: Stub — business input required to complete this section.

| Resource | Notes |
|---|---|
| Engineering | Phases 1–5 (see §13); estimate pending sprint planning |
| Infrastructure | Managed SaaS hosting: registry, audit store, webhook delivery workers |
| Legal | Counsel engagement before on-chain escrow custody goes live (escrow + MSB question) |
| Security audit | Required before on-chain smart contract escrow deployment |
| Shopify app review | App Store submission process; timeline TBD |

---

## 16. Traceability

> **Status**: Standalone PRD — no upstream BRD. `@brd: N/A`

| PRD Element | Upstream Reference | Notes |
|---|---|---|
| All requirements | N/A — standalone PRD | No BRD exists. Requirements are derived from product vision and market context in §3. |
| `PRD.01.01.07` (x402 flow unchanged) | `SPEC.md` security invariants | Must not break existing challenge-proof protocol |
| `PRD.01.01.11` (audit logging) | `SPEC.md` security invariants | Immutable audit trail is a stated security invariant |
| `PRD.01.02.13` (atomic transitions) | `SPEC.md` security invariants | State transition atomicity is a stated security invariant |
| `PRD.01.02.12` (double-spend) | `SPEC.md` security invariants | Double-spend prevention is a stated security invariant |

---

## 17. Glossary

| Term | Definition |
|---|---|
| **A2A** | Agent-to-Agent protocol (v1.0, Linux Foundation, March 2026). Defines how AI agents communicate and exchange structured tasks. |
| **x402** | HTTP payment protocol using the `402 Payment Required` status code. Enables machine-readable payment challenges and proofs over standard HTTP. |
| **MCP** | Model Context Protocol. Defines a structured tool interface for AI models to interact with external services. |
| **USDC** | USD Coin — a fiat-pegged stablecoin on Base (and other chains). The primary payment currency in Key0's x402 rail. |
| **Base** | An Ethereum L2 chain (Coinbase). Key0 supports Base mainnet (chainId 8453) and Base Sepolia testnet (chainId 84532). |
| **Escrow** | Payment held by Key0 pending delivery confirmation. Released to seller on `confirm-delivery` or auto-confirm; returned to buyer on dispute resolution in buyer's favour. |
| **Agent card** | A machine-readable JSON document describing a seller's available services, pricing plans, protocols supported, and delivery characteristics. Analogous to a DNS record for agent commerce. |
| **EARS** | Easy Approach to Requirements Syntax. A structured natural-language format for writing testable requirements. |
| **SYS** | System requirements artifact. Downstream of PRD; generated by `doc-sys-autopilot`. |
| **State machine** | A formal model where each entity (challenge, order, quote, dispute) has a defined set of states and allowed transitions. Key0 enforces all transitions atomically. |
| **Tier A/B/C identity** | Key0's three-tier agent identity model: A = unverified self-asserted, B = OAuth-verified, C = DID-verified. See §4. |
| **`@key0ai/key0`** | The open-source self-hosted Key0 SDK (npm package). Identical in capability to the managed SaaS platform. |
| **`@key0ai/client`** | The buyer-side SDK for agent developers. Wraps the full commerce lifecycle. |
| **Smithery** | The largest actively-curated MCP server registry (`smithery.ai`). Provides a REST API and CLI for discovering and installing MCP servers. Key0 auto-lists seller agent cards on Smithery at registration. Source: smithery.ai |
| **Official MCP Registry** | The Anthropic-maintained canonical MCP server registry (`registry.modelcontextprotocol.io`). Open-source, community-driven, in preview since September 2025. Key0 auto-lists seller agent cards here at registration. |
| **Agent discovery network** | A directory or index where agent developers search for available services and tools. Key0 treats Smithery and the official MCP Registry as the primary distribution channels — where agent developers look when searching for capabilities to integrate. |
| **Founding layer** | Key0's positioning: the commercial infrastructure you start with when building an agent, not an add-on you bolt on later. Analogous to how Stripe is the payment layer startups architect around from day one. |
| **`create-key0-agent`** | The Key0 CLI scaffold tool. `npx create-key0-agent` generates a new agent project with the entire commercial layer pre-built: agent card, pricing plans, payment gate, and registry registration wired at startup. |

---

## 18. Appendix A: Network Effect & Future Roadmap

### Network Effect Model

```
More platforms integrate Key0
  → More agents can transact with Key0 sellers
    → Being a Key0 seller is more valuable
      → More sellers register
        → Registry has more capabilities for agents to discover
          → More platforms integrate Key0
```

This flywheel does not start until the registry and buyer SDK exist. The registry must ship early rather than as an afterthought.

### Quote Comparison (Registry Feature)

The registry can actively broker quote requests on the agent's behalf. An agent submits a job description and budget to the registry once; the registry fans the request out to opted-in sellers in parallel and returns ranked quotes. Sellers opt in by declaring `supportsComparison: true` in their agent card.

### Deferred Platform Connectors

- WooCommerce connector
- WhatsApp Business connector

Timing: demand-signal driven; Shopify app is the first connector.

### Deferred Identity Integrations

- SPIFFE/SPIRE for enterprise workloads
- Verifiable Credentials (DIF Trusted AI Agents WG, IETF WIMSE, OpenID AI Identity Group)

---

*End of PRD-01 v0.3*

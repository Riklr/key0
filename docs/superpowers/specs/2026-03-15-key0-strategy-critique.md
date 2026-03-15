# Key0 Platform — Strategy Critique & Revised Direction

**Date:** 2026-03-15
**Based on:** Deep PRD critique + market research session
**Applies to:** PRD-01 v0.4 (`docs/02_PRD/PRD-01_key0_platform/PRD-01_key0_platform.md`)

---

## 1. What We Validated (Claims That Are True)

| Claim | Evidence | Source |
|---|---|---|
| x402 is live at production scale | 75.41M transactions, $24.24M volume, 94K buyers, 22K sellers — last 30 days | x402.org (verified live, 2026-03-15) |
| A2A v1.0.0 shipped | Released March 12, 2026 | github.com/a2aproject/A2A/releases (verified live, 2026-03-15) |
| Autonomous agent commerce is real today | ChatGPT Instant Checkout (Sept 2025, live on Etsy); Amazon "Buy For Me" (250M users); Shopify AI-driven orders up 15x (Jan 2025 → Jan 2026) | openai.com/index/buy-it-in-chatgpt; Shopify Winter '26 Edition |
| Complex AI agents are deployed and purchasing services | Harvey ($100M ARR, $8B valuation) buys LexisNexis programmatically; Maki ($28.6M) runs hiring agents; AgentMail (hundreds of thousands of agent users) is infrastructure for agents to pay for services | TechCrunch (Harvey Nov 2025; Maki Jan 2025; AgentMail Mar 2026) |
| The full commerce lifecycle is uncontested | No competitor (Nevermined, Fewsats, Kobaru, Foldset) handles quotes + async delivery + delivery verification + disputes + bilateral reputation | Competitive research across all named competitor sites |
| Agent discovery is still manual/hardcoded | No orchestrator autonomously discovers services at runtime; A2A spec explicitly does NOT define how to find agents | A2A spec (a2a-protocol.org/latest/topics/agent-discovery/); GitHub Discussion #741; Solo.io "Agent Discovery, Naming, and Resolution — the Missing Pieces to A2A" |
| Moltbook is a social network, not a service registry | Interface mirrors Reddit; only verified AI agents can post; humans read-only; not a programmatic service directory | moltbook.com; TechCrunch (Jan 2026) |
| Moltbook acquired by Meta | Acquired March 10, 2026; founders joined Meta Superintelligence Labs under Alexandr Wang | techcrunch.com/2026/03/10/meta-acquired-moltbook-the-ai-agent-social-network-that-went-viral-because-of-fake-posts/; axios.com/2026/03/10/meta-facebook-moltbook-agent-social-network |
| Shopify Agentic Plan distributes to major AI platforms | Free plan ($0/month); connects Shopify catalog to ChatGPT, Gemini, Microsoft Copilot, Perplexity, Google AI Mode | shopify.com/in/agentic-plan (visited directly) |
| Shopify UCP partners | Universal Commerce Protocol co-developed with Google; endorsed by Target, Walmart, Wayfair, Etsy, Adyen, Mastercard, Visa, Stripe, American Express, Best Buy, Macy's, Home Depot, Zalando | developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/ |

---

## 2. What the PRD Gets Wrong

### 2.1 Wave Timing — The Wave Is Already Here

**Current PRD says:** "Agent platforms are already provisioning agents with verified identity, on-chain wallets, and payment credentials." (stated as emerging context)

**Reality:** The wave is not approaching — it has arrived. x402 has been processing payments since May 2025 with 75M+ transactions/month. ChatGPT has live checkout. Harvey has $100M ARR from AI-powered legal work. The market framing in §3 should lead with evidence, not prediction.

**Fix:** Rewrite §3 problem statement to open with the market proof, then position Key0 as the infrastructure gap that remains.

---

### 2.2 Primary Persona — Wrong Customer in the Lead

**Current PRD leads with:** API Operator, Digital Goods Vendor, Task Seller, Physical Service Provider, Non-Technical Seller (Shopify), Agent Buyer

**Reality:** The beachhead customer is a single persona with two faces:

> **The Agent Developer / API Developer** — a solo developer or small team who built an AI agent or REST API that does something valuable. Today they monetize it via API keys + human signup. They want agents to pay them without building payment infrastructure. They are already using `@key0ai/key0`.

Sub-types:
- **API Operator** — has an existing REST API, wants zero code changes, just wants agents to be able to pay
- **Agent Builder** — building natively for A2A/MCP, wants discovery + monetization from day one

Both are served by the same product. The distinction is where they are in the transition from "API I sell to humans" to "service I sell to agents."

**The missing buyer persona:** Add **Agent Orchestrator** — a funded team (Maki, Harvey, Kana, 1mind) deploying production agents that need to call specialized services autonomously. These are Key0's design partners on the buy side. The `@key0ai/client` SDK is built for them.

---

### 2.3 Journey A (Shopify Seller) — Remove

**Current PRD:** 2-page detailed onboarding narrative for Shopify sellers, prominent in §7.

**Why it should be removed:**

Shopify launched their own **Agentic Plan** (free, $0/month) that does exactly what Journey A promises — except better:
- Connects Shopify catalog directly to ChatGPT, Gemini, Microsoft Copilot, Perplexity, Google AI Mode (900M+ combined users)
- Uses card payments via Shopify Checkout (zero friction for sellers, no crypto wallet required)
- Normal Shopify payouts to bank account
- Co-developed with Google's Universal Commerce Protocol; endorsed by Walmart, Target, Visa, Mastercard, Stripe, American Express, and 15+ others
- Free — merchants pay only when products sell (2.9% + 30¢ card rate)

Sources: shopify.com/in/agentic-plan (visited directly); developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/

A Shopify seller who wants AI agent customers does not need Key0. Key0's USDC/x402 approach for Shopify sellers asks them to accept crypto payments and get a wallet address in exchange for distribution to `registry.key0.ai` — while Shopify's free plan gives them ChatGPT distribution with card checkout they already understand.

**Fix:**
- Remove Journey A narrative from §7
- Remove `PRD.01.01.63` (Shopify OAuth as account creation)
- Remove `PRD.01.06.25–26` (Shopify-specific onboarding acceptance criteria)
- Remove `PRD.01.08.11–12` (Shopify completion rate and time-to-first-sale KPIs)
- Move generic no-code onboarding (webhook adapter) to Phase 2 in §13 — explicitly deferred, not in §6 In Scope at launch, demand-signal driven

---

### 2.4 Moltbook — Remove All References

**Current PRD:** Lists Moltbook as a key external distribution channel in §7 Journey A, §8 Discovery requirements, §17 Glossary.

**Two independent reasons to remove it:**

**Primary reason (architectural mismatch):** Moltbook is a social network where AI agents post content — analogous to Reddit, not npm or Smithery. Orchestrators do not query it to find payable services. It is not a service registry and was never the right channel for programmatic agent service discovery.

**Secondary reason (no longer independent):** Moltbook was acquired by Meta on March 10, 2026. Founders joined Meta Superintelligence Labs under Alexandr Wang. It no longer exists as an independent distribution channel regardless of its category.

Sources: techcrunch.com/2026/03/10/meta-acquired-moltbook-the-ai-agent-social-network-that-went-viral-because-of-fake-posts/; axios.com/2026/03/10/meta-facebook-moltbook-agent-social-network

**Fix:**
- Remove all Moltbook references from §7, §8, §17
- Remove `PRD.01.06.28` ("External network distribution (Moltbook etc.) confirmed within 5 minutes")
- Update `PRD.01.08.13` — reword from "≥ 3 agent discovery networks" to "Listed on Smithery and official MCP Registry within 60 seconds of registration" (see §2.5 for replacement channels)

---

### 2.5 Discovery Strategy — Wrong Channels

**Current PRD:** "Key0 submits the agent card to opted-in external agent discovery networks (Moltbook, etc.)"

**Reality of agent discovery today:**

| Channel | Servers/size | How discovery works | Agent auto-discovery? |
|---|---|---|---|
| **Smithery** (`smithery.ai`) | 2,000+ MCP servers | REST API (`registry.smithery.ai`), CLI install | No — developer-initiated |
| **mcp.so** | 18,503 servers | Human browse | No |
| **Official MCP Registry** (`registry.modelcontextprotocol.io`) | Anthropic-maintained, preview since Sept 2025 | REST API | No |
| **A2A `/.well-known/agent-card.json`** | Spec-defined | Static HTTP GET if you know the domain | Theoretically yes, not in practice |
| **Moltbook** | Social network | Reddit-style content posting | Not applicable — wrong category |

Sources: smithery.ai/docs/use/registry; registry.modelcontextprotocol.io; a2a-protocol.org/latest/topics/agent-discovery/; GitHub Discussion #741

**The gap Key0 can fill:** The A2A spec explicitly states it does not define how to find agents. GitHub Discussion #741 ("Agent Registry Proposal") is an open, unresolved community request. `registry.key0.ai` has the opportunity to be the reference implementation for payment-enabled agent discovery — the missing piece the spec acknowledges.

**Revised distribution strategy:**
1. **Short term:** Auto-list Key0 sellers on Smithery and the official MCP Registry at registration. This is where developers look today.
2. **Medium term:** `registry.key0.ai` becomes the payment-enabled agent directory filling the A2A community's acknowledged gap.
3. **Long term:** Contribute `registry.key0.ai` spec to the A2A working group as a reference implementation.

---

### 2.6 USDC-Only → All Payment Instruments

**Current PRD:** Explicitly scoped to USDC on Base. "No fiat off-ramp" is listed as a non-goal (§11).

**Strategic decision:** Support all payment instruments. USDC/x402 ships first; fiat rails (e.g. Stripe adapter) follow.

**Why this matters:**
- Enterprise agents (Harvey, Maki, Kana) operate with fiat budgets — they do not have funded USDC wallets
- Competitors (Nevermined, Fewsats) already support fiat + crypto
- Once fiat is supported, the payment rail is no longer a differentiator — **the full commerce lifecycle becomes the entire moat**

**Important:** Adding fiat payment adapters carries the same MSB/FinCEN regulatory exposure as escrow (see §2.8). A Stripe adapter where Key0 receives and transmits fiat funds may constitute money transmission regardless of whether escrow is active. Legal counsel review applies to any fiat adapter, not only to escrow.

**Fix:**
- Remove "No fiat off-ramp" from §11 non-goals
- Update §10 architecture to treat payment rail as pluggable (x402/USDC first, Stripe adapter planned)
- Add legal note: MSB analysis required before any fiat adapter ships

---

### 2.7 Business Model — Missing Entirely

**Current PRD:** No mention of how Key0 makes money across all 17 sections.

**Decision:** Transaction fee model (~2% per transaction).

**Unit economics sketch:**
- $1M ARR requires $50M in annual payment volume
- At $10 avg transaction (research jobs, data feeds): 5M transactions/year
- At $50 avg transaction (complex services): 1M transactions/year
- Implication: Key0 generates minimal revenue for 12–18 months — this is a venture-scale bet requiring runway

**Blocker — OQ-A must be resolved before this section can be finalized in the PRD:** The fee collection mechanism is not yet determined. For USDC/x402 transactions that go wallet-to-wallet on Base, how does Key0 intercept its 2%? Options include routing through a Key0 fee address, collecting via the facilitator layer, or billing separately. This is not a minor implementation detail — if Key0 cannot technically collect a fee on wallet-to-wallet transactions, the entire revenue model changes. Additionally, for any fiat payment adapter (see §2.6), the MSB/FinCEN analysis applies to fee collection as well: receiving a percentage of a fiat transaction may itself constitute money transmission. See OQ-A in §6.

**Fix:** Add a brief business model note to §2 Executive Summary and §5 KPIs. Mark as pending resolution of OQ-A.

---

### 2.8 Escrow — Defer, Two Implementation Paths

**Current PRD:** Escrow treated as optional Phase 1 feature. Legal risk noted in one sentence.

**Reality:** Escrow = Key0 holds funds on behalf of parties = money transmission under US FinCEN rules = potential MSB licensing requirement ($1M+, 12–18 months, 49 state licenses). This is a potential showstopper if pursued naively.

**Decision:**
- Escrow remains in the PRD as a planned feature
- **Explicitly deferred post-launch**
- When implemented, one of two paths only:
  - **Path A:** On-chain smart contract (formally audited). Funds held on-chain; Key0 never touches them. Not money transmission.
  - **Path B:** Licensed money transmitter partnership (Stripe, Coinbase). They hold funds; Key0 is the software orchestration layer.
- Key0 does NOT hold funds directly under any scenario

**Fix:**
- Update `PRD.01.01.09` (escrow mode): mark as deferred, add two implementation paths
- Update `PRD.01.08.09` (escrow release KPI): mark as applicable only post-escrow-launch
- Update `PRD.01.06.14–16` (escrow verification acceptance criteria): mark as deferred
- Update §13 Phase 1: remove escrow from initial scope
- Update §11 Constraints: add "Escrow deferred post-launch. Implementation via smart contract or licensed money transmitter partner only. Key0 does not hold funds directly."

---

### 2.9 Phase Ordering — Flip It

**Current PRD phase order:**
1. Core order lifecycle (state machine, escrow, delivery, receipts)
2. Negotiation (quotes)
3. Disputes
4. No-code onboarding (Shopify app)
5. Network (registry, reputation, buyer SDK)

**Problem:** The beachhead customers (existing `@key0ai/key0` SDK users) need Phase 5 first. They already have payment-gated endpoints. They need a registry listing and managed platform — not a dispute system for commerce flows they aren't running yet.

**Revised approach:** Phase ordering should be customer-driven, not predetermined. Based on the beachhead strategy:
- **Phase 1:** Managed platform + registry (convert existing SDK users; auto-list on Smithery + MCP Registry). Add migration path from self-hosted SDK → managed platform as a first-class Phase 1 deliverable.
- **Phase 2+:** Whatever the first customer cohort actually requires (likely async delivery or quotes — determined by talking to customers, not predetermined)
- **Defer:** Shopify app (no longer a priority); escrow (legal complexity)

---

### 2.10 Cold Start Strategy — Use Existing SDK Users

**Current PRD:** Risk `PRD.01.07.10` notes the cold-start problem; mitigation is "target API operators first" — one sentence.

**Gap:** The PRD is aware of existing SDK users as a target segment but provides no migration path specification. The supply side already exists; the missing piece is the mechanism to convert self-hosted deployments to managed platform + registry listings.

**Revised strategy:**
1. Build a one-click migration path: self-hosted SDK → managed platform (Phase 1 deliverable)
2. Auto-generate registry listing from existing `SellerConfig` on migration
3. Auto-push listing to Smithery + official MCP Registry
4. Sellers get buyer discovery without additional work

**Fix:** Add "migration path from self-hosted SDK to managed platform" as an explicit Phase 1 requirement in §13.

---

### 2.11 Technical Fix — Copy Error in Well-Known URI

**Current PRD:** References `/.well-known/agent.json` in `PRD.01.01.61` and §17 Glossary.

**Reality:** A2A v0.3.0 (July 2025) changed the well-known URI from `agent.json` to `agent-card.json`. Since the PRD targets A2A v1.0 (March 2026), using `agent.json` is a copy error — the PRD was written against an outdated reference, not a version-lag issue.

**Fix:** Search the entire PRD for all occurrences of `agent.json` (not just `PRD.01.01.61` and §17 Glossary) and update each to `agent-card.json`. Note: `key0.ai/s/{seller-id}/agent.json` in Journey A is a custom seller endpoint URL, not the well-known URI — if Journey A is removed, this disappears naturally. The well-known URI fix targets are `PRD.01.01.61` and §17 Glossary, but a full-text search is required to confirm no other occurrences exist.

---

### 2.12 Competitive Table — Wrong Comparisons

**Current PRD §3:** Compares Key0 to Stripe, OpenAI Actions, Shopify.

**Reality:** These are not the relevant competitors for the agent developer / API monetization market. The real competitive set:

| Competitor | What they do | Key0's advantage | Status | Source |
|---|---|---|---|---|
| **Nevermined** | MCP + A2A + x402 + AP2, fiat + crypto, usage/outcome pricing | Full commerce lifecycle (async delivery, disputes, bilateral reputation) | Live | nevermined.io |
| **Fewsats** | MCP-native payments, fiat + crypto, human-in-loop controls | Async delivery + disputes + reputation | Live | fewsats.com |
| **Kobaru** | Zero-code x402 proxy, fiat + crypto settlement | Registry + discovery + full commerce lifecycle | Live | kobaru.io (x402.org ecosystem) |
| **Foldset** | Free x402 gateway for any API/MCP/URL | Full commerce lifecycle, not just payment gating | Live | x402.org ecosystem |
| **Stripe Agent Toolkit** | Fiat payments in agentic workflows (OpenAI Agents SDK, LangChain, CrewAI) | On-chain option + async commerce lifecycle | Developer preview | docs.stripe.com/agents |

Key0's moat is not the payment rail — competitors match on that. The moat is:
1. Full commerce lifecycle: quotes → async fulfillment → delivery verification → disputes
2. Bilateral reputation with immutable audit trail
3. Payment-enabled discovery registry (the acknowledged A2A gap)

**Fix:** Replace §3 competitive table with the above. Preserve "planned" vs "live" status markers on Key0's own capabilities.

---

## 3. What Stays — Genuine Strengths

- **State machine architecture** — atomicity, compare-and-swap, no direct writes. Proven in existing code.
- **Full commerce lifecycle** — quotes, async delivery, disputes, bilateral reputation. No competitor has this.
- **Protocol agnosticism** — A2A + MCP. Right call.
- **Backward compatibility commitment** — existing x402 flows unchanged.
- **SDK-first developer experience** — 3 lines of code. Right for the target persona.
- **`registry.key0.ai` vision** — fills an acknowledged A2A spec gap. Defensible long-term position.
- **Signed commerce receipts** — cryptographic proof of commerce. Underrated; genuinely novel.

---

## 4. Revised Customer Hierarchy

### Primary: Agent Developer / API Developer
Solo developer or small team who built a valuable API or AI agent. Wants to monetize agent-to-agent traffic without building payment infrastructure.
- Sub-type A: **API Operator** — existing REST API, zero code change desired
- Sub-type B: **Agent Builder** — building natively for A2A/MCP, wants discovery + monetization from day one

**Entry point:** `npm install @key0ai/key0` → 3 lines → live. Managed platform for those who don't want to run infrastructure.

### Secondary: Agent Orchestrator (Buyer)
Funded team deploying production agents that need to call specialized services autonomously. Design partners for `@key0ai/client`.

Examples: Maki (hiring), Harvey (legal), Kana (marketing), 1mind (sales) — companies whose agents need to purchase data, computation, or task work from other agents.

**Entry point:** `@key0ai/client` SDK + Smithery discovery.

### Tertiary (later, demand-signal driven): Non-Technical Service Seller
Generic webhook adapter. No Shopify-specific integration at launch.

---

## 5. PRD Sections That Need Updating

| Section | Change Required | Specific IDs Affected | Priority |
|---|---|---|---|
| §1 Document Control | Bump to v0.5, update date | — | Low |
| §2 Executive Summary | Rewrite: wave is here, not coming; add transaction fee business model note | — | High |
| §3 Problem Statement | Rewrite with market evidence (x402 stats, Harvey, ChatGPT checkout); replace competitive table with Nevermined/Fewsats/Kobaru comparisons | — | High |
| §4 Personas | Add Agent Developer as primary persona; add Agent Orchestrator buyer persona; demote Non-Technical Seller to Tertiary (later, demand-signal driven) — do not delete the persona, just reorder and reframe | — | High |
| §5 KPIs | Add transaction fee revenue KPI; remove Shopify KPIs; reword network distribution KPI | `PRD.01.08.11–12` (remove); `PRD.01.08.13` (reword: Smithery + MCP Registry listing) | High |
| §7 User Stories | Remove Journey A (Shopify); add Agent Developer and Agent Orchestrator journeys | `PRD.01.09.05` (reframe or remove Shopify user story) | High |
| §8 Functional Requirements | Update Discovery & Distribution: remove Moltbook, add Smithery/MCP Registry auto-listing; remove Shopify OAuth requirement; update well-known URI | `PRD.01.01.61` (`agent-card.json`); `PRD.01.01.63` (remove); `PRD.01.01.58–60` (reword for Smithery) | High |
| §8 Transaction Requirements | Mark escrow as deferred; add fiat adapter as planned (with legal caveat) | `PRD.01.01.09` (escrow — defer); `PRD.01.01.10` (fiat rail — mark planned) | High |
| §11 Constraints | Remove "No fiat off-ramp" from non-goals; add escrow deferral with two implementation paths; add MSB legal note for fiat adapters | — | High |
| §13 Implementation | Add Phase 0/1: managed platform + registry + SDK migration path; flip phase order; defer Shopify app and escrow | — | High |
| §14 Acceptance Criteria | Remove Shopify-specific criteria; remove Moltbook distribution criterion; update discovery criteria for Smithery | `PRD.01.06.25–26` (remove); `PRD.01.06.28` (remove); `PRD.01.06.14–16` (mark deferred with escrow) | High |
| §14 KPI Acceptance | Mark escrow release criteria as deferred | `PRD.01.08.09` (deferred) | Medium |
| §17 Glossary | Fix `agent.json` → `agent-card.json`; remove Moltbook entry; add Smithery, Nevermined | — | Medium |

---

## 6. Open Questions (Not Resolved in This Session)

| # | Question | Why It Matters |
|---|---|---|
| OQ-A | How does Key0 collect its transaction fee when payments go wallet-to-wallet on Base? Does the facilitator intercept, or does Key0 require routing through a Key0-controlled address? **This is a blocker for the business model section of the PRD** — the unit economics in §2.7 are only valid if the fee can be technically collected. Also has legal implications for fiat adapters (collecting a % of fiat transactions may constitute money transmission). Must be resolved before PRD §5 KPIs and §2 Executive Summary are finalized. | **BLOCKER** — Revenue model validity |
| OQ-B | What exactly does the one-click migration path from self-hosted SDK to managed platform look like? Is the managed platform a hosted version of the same Redis/Postgres storage, or a different architecture? | Phase 1 scoping |
| OQ-C | Should `@key0ai/client` be an MCP server itself, so any MCP-capable orchestrator can discover and pay Key0 sellers without framework-specific integration? | Buyer-side adoption velocity |
| OQ-D | What is the Smithery listing process? Manual submission or Key0 builds a programmatic push to Smithery's registry API? | Distribution execution |
| OQ-E | Does bilateral reputation ship at v1? Reputation requires transaction history to be meaningful — premature with few transactions. Consider deferring until first 1,000 transactions recorded. | Scope |
| OQ-F | Does Key0 formally engage with the A2A working group to position `registry.key0.ai` as the reference implementation for GitHub Discussion #741? | Long-term moat and community positioning |

---

---

## 7. Product Positioning & Persona Deep-Dive

### 7.1 Core Positioning Decision: Founding Layer, Not Add-On

Key0's positioning must be **founding layer**, not payment add-on. This is the single most important strategic decision from this session.

**Add-on positioning (rejected):**
> "Add Key0 to your existing API for agent payments."

Key0 is step 10 in an agent's development. It's a plugin. It's optional. Developers add it when they need it, skip it when they don't. This is the Kobaru/Foldset/Nevermined positioning — they all live here.

**Founding layer positioning (chosen):**
> "Key0 is the commercial foundation for AI agents."

Key0 is step 1. The commercial identity — agent card, pricing, payment gate, registry listing, reputation — exists from the first line of code. Developers architect their agent around Key0, not onto it. This is the Stripe model: Stripe's best customers start with Stripe before their first user.

**Why this is defensible:** No other tool in the agent ecosystem owns the commercial-layer narrative. LangChain helps agents do things. CrewAI helps agents work together. Key0 helps agents earn money. These are complementary, not competing. Key0 slots in as the commercial layer on top of whatever orchestration framework the developer chooses.

---

### 7.2 Positioning Statement

> **Key0 is the commercial foundation for AI agents.**
>
> Start with Key0 and your agent is a business from day one — discoverable on every agent registry, payable by any AI system, and building a reputation with every transaction.
>
> Don't build payment infrastructure. Don't worry about discovery. Don't negotiate contracts. Write the part that matters: what your agent does.

---

### 7.3 Two Doors Into the Same Product

The same product serves two customer types with different entry points and emotional hooks. These are two sections of the website and docs, not two products.

#### Door 1: For Agent Builders
**Headline:** *"Build agents that earn money"*

**Who:** Developer building a new AI agent — a candidate screener, legal doc summarizer, market research agent, competitive intelligence tool — who wants it to be a commercial product from day one.

**Emotional hook:** Passive income from code you write once. Your agent earns while you sleep.

**Their current alternative:** Build the agent logic with LangChain/CrewAI/custom, then figure out monetization separately — website, pricing page, Stripe integration, contract negotiation, custom auth. Weeks of work before the first dollar.

**Key0's answer:** `npx create-key0-agent` scaffolds a project where the commercial identity is pre-built. You open the project and your agent already has a name, a price, an agent card, and a registry listing. You write what it does. Key0 handles everything else.

**Entry point:** `npx create-key0-agent` CLI ← **this needs to be built as a first-class product**

**Time to first earning agent:** < 1 day on a new project.

#### Door 2: For API Developers
**Headline:** *"Make your API agent-payable"*

**Who:** Developer with an existing REST API who sees agent traffic hitting their signup wall. They have human customers, API keys, maybe a Stripe subscription. They don't want to rebuild anything — they want to capture revenue from agents that are already trying to reach them.

**Emotional hook:** Stop leaving agent revenue on the table. Your API already does the work — now make it pay.

**Their current alternative:** Nothing. Agents bounce off their signup wall. Revenue is $0 from agent traffic regardless of volume.

**Key0's answer:** `npm install @key0ai/key0`, 3 lines of config, existing API untouched. Agents can now discover and pay. Human customers unaffected.

**Entry point:** `npm install @key0ai/key0` mid-project

**Time to first agent payment:** < 1 hour on an existing API.

---

### 7.4 Who We Are NOT Targeting (and Why)

| Segment | Why Not | What They Use Instead |
|---|---|---|
| **Shopify sellers** | Shopify's own Agentic Plan ($0/month) connects their catalog to ChatGPT/Gemini/Copilot with card checkout and normal bank payouts. Key0 asking them to accept USDC is a worse deal on every dimension. | Shopify Agentic Plan |
| **Large enterprise API providers** (LexisNexis, Bloomberg, Salesforce) | Enterprise sales teams, annual contracts, procurement processes. Will not replace billing infrastructure with per-transaction x402. May eventually expose a Key0 adapter if agent buyer demand is proven — but that's a pull motion, not a push one. | Existing enterprise contracts |
| **Consumer app developers** (building human-facing AI products) | Their customers are humans using ChatGPT or Gemini. They need Shopify Agentic Plan + Google UCP + OpenAI Checkout. Traditional card payments, not agent-native protocols. | Google UCP, OpenAI ACP, Shopify |
| **AI platform builders** (OpenAI, Anthropic, Google, LangChain) | They build agents, not sell to agents. They are potential distribution partners — getting Key0 listed as an MCP server in Claude Desktop or Cursor — not sales targets. | N/A — partnership opportunity |
| **Physical goods sellers** (for now) | Agents primarily buy digital goods today. Autonomous physical fulfillment (drone delivery, print-on-demand) is a 2028+ problem. Escrow and physical fulfillment features required are explicitly deferred. | Human commerce channels |

---

### 7.5 Product Implication: The CLI Is a First-Class Deliverable

The "founding layer" positioning requires a `create-key0-agent` CLI that does not currently exist in the PRD or codebase. This is not a nice-to-have — it is the primary on-ramp for the Agent Builder persona.

**What it scaffolds:**
```bash
npx create-key0-agent my-research-agent
# → Prompts: framework (Express/Hono/Fastify/MCP), network (mainnet/testnet),
#            plans (name + price), wallet address
# → Generates: fully configured project with agent card, payment gate,
#              registry registration on first run, Smithery listing
```

**Analogues:** `create-react-app`, `create-next-app`, `create-t3-app` — the founding tools that defined their ecosystems by making the right architecture the easy architecture.

**PRD impact:** Add `create-key0-agent` CLI as a Phase 1 deliverable in §13. Add corresponding acceptance criterion in §14.

---

### 7.6 Revised §4 Structure for PRD

Replace the current 6-persona flat list with a "two doors" structure:

**§4.1 — For Agent Builders** (primary, founding layer path)
Full persona narrative: who they are, their current pain, why Key0, entry point, success metric.

**§4.2 — For API Developers** (primary, retrofit path)
Full persona narrative: existing API, agent traffic bouncing, 3-line integration, zero disruption to existing setup.

**§4.3 — For Non-Technical Service Sellers** (tertiary, later)
Brief note: webhook adapter path, demand-signal driven, no launch priority.

**Remove entirely:**
- Shopify Seller persona (Shopify Agentic Plan makes this obsolete)
- Physical Service Provider persona (move to Appendix / Future Roadmap)
- "Agent Buyer" as a persona (buyers are not Key0 customers; they interact via standard x402 protocol)

---

*End of strategy critique document.*

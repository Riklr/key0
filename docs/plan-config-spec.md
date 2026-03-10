# Enhanced Plan Configuration — Spec

**Version**: 0.3
**Date**: 2026-03-10
**Context**: Modeling real-world API pricing (TinyFish AI as reference case)

---

## 1. Design Philosophy

Key2a is a **payment + credential protocol**, not a billing platform.

- Key2a shows plans, collects USDC, issues a credential.
- **Everything after** — quota tracking, concurrency enforcement, feature gating, renewals — is the **seller's backend**.
- The `Plan` config should let sellers **describe** their offering for discovery/UI, not **enforce** it.

---

## 2. What We Add to `Plan`

| Field | Purpose |
|---|---|
| `description` | Human-readable plan summary |
| `features` | List of what's included — for display in agent card / Setup UI |
| `tags` | Metadata like `"most-popular"` — for UI badges |

That's it. Three optional fields. Zero breaking changes.

---

## 3. Proposed Types

```typescript
type PlanFeature = {
  readonly key: string;       // machine-readable: "llm-costs", "concurrent-agents"
  readonly label: string;     // human-readable: "All LLM costs included"
  readonly value?: string | number | boolean;  // true, 30, "priority"
};

type Plan = {
  readonly planId: string;
  readonly displayName: string;
  readonly description?: string;                // NEW
  readonly unitAmount: string;                  // "$0.015", "$15.00"
  readonly resourceType: string;                // "step", "api-call"
  readonly expiresIn?: number;                  // token lifetime in seconds (undefined = single-use)
  readonly features?: readonly PlanFeature[];   // NEW
  readonly tags?: readonly string[];            // NEW — ["most-popular"]
};
```

---

## 4. How Duration/Billing Interval Works

No new billing fields. Seller creates **separate plans** for monthly vs yearly. The `expiresIn` already controls token lifetime.

```
Per-use plan → expiresIn: undefined     (single-use)
Monthly plan → expiresIn: 2592000       (30 days)
Yearly plan  → expiresIn: 31536000      (365 days)
```

The UI groups plans by `expiresIn` and shows a dynamic toggle:
- All `undefined` → no toggle (per-use only)
- Mixed durations → toggle: **Per use** | **Monthly** | **Annual**

---

## 5. TinyFish AI Example

```typescript
const plans: Plan[] = [
  {
    planId: "payg",
    displayName: "Pay-as-you-go",
    description: "Best for low-volume or unpredictable workflows",
    unitAmount: "$0.015",
    resourceType: "step",
    features: [
      { key: "concurrent-agents", label: "2 concurrent agents", value: 2 },
      { key: "llm-costs", label: "All LLM costs included", value: true },
      { key: "anti-bot", label: "Anti-bot protection included", value: true },
      { key: "remote-browser", label: "Remote browser at $0/hour", value: true },
      { key: "residential-proxy", label: "Residential proxy at $0/GB", value: true },
      { key: "run-history", label: "30-day run history", value: 30 },
      { key: "support", label: "Email support", value: "email" },
    ],
  },
  {
    planId: "starter-monthly",
    displayName: "Starter",
    description: "Best for developers running daily workflows",
    unitAmount: "$15.00",
    resourceType: "step",
    expiresIn: 2592000,
    features: [
      { key: "steps", label: "1,650 steps/month", value: 1650 },
      { key: "concurrent-agents", label: "10 concurrent agents (5x throughput)", value: 10 },
      { key: "llm-costs", label: "All LLM costs included", value: true },
      { key: "anti-bot", label: "Anti-bot protection, auto-configured per run", value: true },
      { key: "remote-browser", label: "Remote browser at $0/hour", value: true },
      { key: "residential-proxy", label: "Residential proxy at $0/GB", value: true },
      { key: "run-history", label: "30-day run history with full observability", value: 30 },
      { key: "support", label: "Priority email support", value: "priority-email" },
      { key: "workbench", label: "TinyFish Workbench, API, and MCP Integration", value: true },
      { key: "overage", label: "Past 1,650 steps: $0.014/step", value: "$0.014" },
    ],
    tags: ["most-popular"],
  },
  {
    planId: "starter-yearly",
    displayName: "Starter",
    description: "Best for developers running daily workflows — save 7%",
    unitAmount: "$168.00",
    resourceType: "step",
    expiresIn: 31536000,
    features: [
      { key: "steps", label: "1,650 steps/month", value: 1650 },
      { key: "concurrent-agents", label: "10 concurrent agents (5x throughput)", value: 10 },
      { key: "llm-costs", label: "All LLM costs included", value: true },
      { key: "anti-bot", label: "Anti-bot protection, auto-configured per run", value: true },
      { key: "run-history", label: "30-day run history with full observability", value: 30 },
      { key: "support", label: "Priority email support", value: "priority-email" },
      { key: "workbench", label: "TinyFish Workbench, API, and MCP Integration", value: true },
      { key: "overage", label: "Past 1,650 steps: $0.014/step", value: "$0.014" },
    ],
    tags: ["most-popular"],
  },
  {
    planId: "pro-monthly",
    displayName: "Pro",
    description: "Best for development teams who have high-volume workflows",
    unitAmount: "$150.00",
    resourceType: "step",
    expiresIn: 2592000,
    features: [
      { key: "steps", label: "16,500 steps/month", value: 16500 },
      { key: "concurrent-agents", label: "50 concurrent agents (25x throughput)", value: 50 },
      { key: "llm-costs", label: "All LLM inference costs included", value: true },
      { key: "anti-bot", label: "Anti-bot protection, auto-configured per run", value: true },
      { key: "run-history", label: "180-day run history with full observability", value: 180 },
      { key: "support", label: "Priority email + Slack/Discord community", value: "priority-all" },
      { key: "workbench", label: "TinyFish Workbench, API, and MCP Integration", value: true },
      { key: "overage", label: "Past 16,500 steps: $0.012/step", value: "$0.012" },
    ],
  },
  {
    planId: "pro-yearly",
    displayName: "Pro",
    description: "Best for development teams — save 12%",
    unitAmount: "$1584.00",
    resourceType: "step",
    expiresIn: 31536000,
    features: [
      { key: "steps", label: "16,500 steps/month", value: 16500 },
      { key: "concurrent-agents", label: "50 concurrent agents (25x throughput)", value: 50 },
      { key: "llm-costs", label: "All LLM inference costs included", value: true },
      { key: "anti-bot", label: "Anti-bot protection, auto-configured per run", value: true },
      { key: "run-history", label: "180-day run history with full observability", value: 180 },
      { key: "support", label: "Priority email + Slack/Discord community", value: "priority-all" },
      { key: "workbench", label: "TinyFish Workbench, API, and MCP Integration", value: true },
      { key: "overage", label: "Past 16,500 steps: $0.012/step", value: "$0.012" },
    ],
  },
];
```

---

## 6. UI Behavior

### Setup UI — Seller configuring plans
- Form to add/edit plans with: name, description, price, duration, features list
- Features are freeform key/label/value — seller types whatever they want
- Tags dropdown: "most-popular", "recommended", "new"

### Buyer-facing UI / Agent Card
- Dynamic duration toggle based on `expiresIn` buckets
- `tags: ["most-popular"]` renders a badge on the plan card
- Features render as a checklist under each plan

### Agent / MCP client
- Sees all plans via `discover_plans` — picks by `planId`
- Reads features programmatically via `key`/`value` for decision-making

---

## 7. Migration

Zero breaking changes. All three new fields are optional:
- `description` → `undefined` (not shown)
- `features` → `undefined` (no feature list)
- `tags` → `undefined` (no badges)

Existing configs work unchanged.

---

*End of Spec v0.3*

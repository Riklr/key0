# Enhanced Plan Configuration — Spec

**Version**: 0.3
**Date**: 2026-03-10
**Context**: Modeling real-world API pricing (TinyFish AI as reference case)

---

## 1. Design Philosophy

Key0 is a **payment + credential protocol**, not a billing platform.

- Key0 shows plans, collects USDC, issues a credential.
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
type Plan = {
  readonly planId: string;
  readonly displayName: string;
  readonly description?: string;                // NEW
  readonly unitAmount: string;                  // "$0.015", "$15.00"
  readonly resourceType: string;                // "step", "api-call"
  readonly expiresIn?: number;                  // token lifetime in seconds (undefined = single-use)
  readonly features?: readonly string[];        // NEW — ["1,650 steps/month", "10 concurrent agents"]
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
      "2 concurrent agents",
      "All LLM costs included",
      "Anti-bot protection included",
      "Remote browser at $0/hour",
      "Residential proxy at $0/GB",
      "30-day run history",
      "Email support",
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
      "1,650 steps/month",
      "10 concurrent agents (5x throughput)",
      "All LLM costs included",
      "Anti-bot protection, auto-configured per run",
      "Remote browser at $0/hour",
      "Residential proxy at $0/GB",
      "30-day run history with full observability",
      "Priority email support",
      "TinyFish Workbench, API, and MCP Integration",
      "Past 1,650 steps: $0.014/step",
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
      "16,500 steps/month",
      "50 concurrent agents (25x throughput)",
      "All LLM inference costs included",
      "Anti-bot protection, auto-configured per run",
      "180-day run history with full observability",
      "Priority email + Slack/Discord community",
      "TinyFish Workbench, API, and MCP Integration",
      "Past 16,500 steps: $0.012/step",
    ],
  },
];
```

---

## 6. UI Behavior

### Setup UI — Seller configuring plans
- Form to add/edit plans with: name, description, price, duration, features list
- Features are plain strings — one per line in a textarea
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

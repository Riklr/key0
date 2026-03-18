# Pay-Per-Request Redesign Spec

**Date:** 2026-03-19
**Branch:** feat/pay-per-request
**Status:** Draft

---

## Overview

The current `feat/pay-per-request` branch introduces pay-per-request billing but with a config shape that conflates two separate concepts: subscription plans and priced API routes. This spec redesigns the config surface, adds transparent HTTP proxy support for brownfield sellers, and ensures all routes (paid and free) are accessible via HTTP, A2A, and MCP — with full discovery. It also updates the Docker setup UI (dashboard) to expose these concepts intuitively.

### Goals

- Routes and plans are separate top-level concepts in `SellerConfig`
- Brownfield sellers can add Key0 in front of an existing API with minimal backend changes — existing API response shapes are preserved exactly (no wrapper)
- Every route is accessible via HTTP (transparent proxy), A2A (`/x402/access`), and MCP
- Discovery exposes the full API spec (routes and plans) so agent clients can find and call any endpoint
- `fetchResourceCredentials` is only required when subscription plans exist
- The Docker setup UI makes it intuitive to configure both routes and plans
- No breaking changes to the subscription flow

### Non-Goals

- Per-route timeout configuration (future work)
- HMAC-signed payment headers (future work)
- Dynamic route discovery from backend OpenAPI specs
- Dashboard authentication (existing security model unchanged — `/setup` is Docker-internal only)

---

## Config API Changes

### `Plan` — Subscription-only

Plans become purely subscription-focused. All PPR/proxy/free fields are removed.

```typescript
type Plan = {
  planId: string;
  unitAmount: string;       // required — subscription price
  description?: string;
};
```

**Removed from Plan:** `mode`, `free`, `proxyPath`, `proxyMethod`, `proxyQuery`, `routes`

### `Route` — New type

A `Route` is a priced (or free) API endpoint that Key0 exposes via transparent proxy, A2A, and MCP.

```typescript
type Route = {
  routeId: string;                                           // stable identifier used in discovery + A2A/MCP calls
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;                                             // Express-style :param (e.g. "/api/weather/:city")
  unitAmount?: string;                                      // omit for free routes
  description?: string;
};
```

A route with no `unitAmount` is free — no payment required, proxied directly.

### `SellerConfig` — Updated

`fetchResource` (the programmatic proxy callback from the current branch) is removed. `proxyTo` is the only proxy mechanism when using the gateway mode. Sellers who need custom routing logic should handle it in their backend behind the proxy.

```typescript
type SellerConfig = {
  agentName: string;
  walletAddress: `0x${string}`;
  network: "mainnet" | "testnet";
  basePath?: string;                                         // default "/agent"

  plans?: Plan[];                                           // subscription tiers (optional)
  routes?: Route[];                                         // per-request + free endpoints (optional)

  fetchResourceCredentials?: FetchResourceCredentialsFn;   // required only when plans is non-empty
  proxyTo?: ProxyToConfig;                                  // required when routes is non-empty

  // ... existing optional fields (redis, rpcUrl, gasWalletPrivateKey, etc.)
};
```

**Validation rules (enforced at startup):**
- If `plans` is non-empty → `fetchResourceCredentials` is required
- If `routes` is non-empty → `proxyTo` is required
- If both are absent → warn and proceed (developer mode / health-check only)

### `ProxyToConfig` — Unchanged

```typescript
type ProxyToConfig = {
  baseUrl: string;
  headers?: Record<string, string>;     // static headers added to every proxied request
  proxySecret?: string;                 // injected as x-key0-internal-token header
};
```

### `ResourceResponse` type — Updated

`planId` becomes optional (only present for subscription flows); `routeId` is added for route flows.

```typescript
type ResourceResponse = {
  type: "ResourceResponse";
  challengeId: string;
  requestId: string;
  planId?: string;       // present for subscription access grants
  routeId?: string;      // present for route-based calls
  txHash?: `0x${string}`; // absent for free routes
  explorerUrl?: string;   // absent for free routes
  resource: {
    status: number;
    headers?: Record<string, string>;
    body: unknown;
  };
};
```

---

## Behavior

### Transparent HTTP Proxy

When `routes` is configured, Key0 auto-mounts each route at its declared `method` + `path` on the same server at startup. The seller registers no additional routes manually.

The transparent proxy forwards the matched Express path (with parameters already substituted) to `proxyTo.baseUrl`. For example, a request to `GET /api/weather/london` matching route `GET /api/weather/:city` is forwarded to `{baseUrl}/api/weather/london` verbatim. Query parameters from the original request are forwarded unchanged.

**Paid route flow:**
1. Request arrives at e.g. `GET /api/weather/london`
2. No `PAYMENT-SIGNATURE` header → respond `402 Payment Required` with requirements
3. Valid `PAYMENT-SIGNATURE` → settle on-chain → proxy to `proxyTo.baseUrl + matched path` → return backend response body and headers **unchanged**
4. Backend non-2xx → initiate refund → return backend error status + body **unchanged**

**Free route flow:**
1. Request arrives at e.g. `GET /health`
2. Proxy directly to `proxyTo.baseUrl + matched path` → return backend response unchanged

The backend response is **never wrapped** for transparent proxy routes. Status code, headers, and body pass through exactly as received from the backend.

**Headers added to the upstream request (transparent proxy only):**
- `x-key0-internal-token` — if `proxySecret` is set; use this in the backend to verify the request came through Key0
- `x-key0-tx-hash`, `x-key0-route-id`, `x-key0-amount`, `x-key0-payer` — on paid routes only (informational; not tamper-proof, do not use for trust decisions)

### A2A and MCP Access

All routes — paid and free — are also accessible via `POST /x402/access` and MCP tools. The behavior is identical to the transparent proxy (same settlement, same backend call) but the response is wrapped in `ResourceResponse` for protocol compatibility.

**A2A request shape for routes:**
```json
{
  "routeId": "weather",
  "resource": { "method": "GET", "path": "/api/weather/london" }
}
```

`/x402/access` continues to accept `planId` for subscription flows unchanged. It now also accepts `routeId` for route flows. Exactly one of `planId` or `routeId` must be present.

**A2A response for paid routes:**
```json
{
  "type": "ResourceResponse",
  "challengeId": "...",
  "requestId": "...",
  "routeId": "weather",
  "txHash": "0x...",
  "explorerUrl": "...",
  "resource": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "body": { "temp": 72 }
  }
}
```

For free routes, `txHash` and `explorerUrl` are absent. For backend non-2xx responses via A2A: refund is initiated, and the backend error is surfaced inside `resource` (status + body from backend unchanged).

**MCP tools:**
- `discover_plans` → renamed to `discover_api` — returns both plans and routes
- `request_access` → handles both `planId` (subscription) and `routeId` (route); exactly one required

### Error Pass-Through Contract

| Access path | Backend 2xx | Backend non-2xx | Settlement after error |
|---|---|---|---|
| HTTP transparent proxy | Pass through unchanged | Pass through unchanged | Refund initiated |
| A2A / MCP | Wrapped in `ResourceResponse.resource` | Wrapped in `ResourceResponse.resource` | Refund initiated |

In both cases, the backend status code and body are preserved. Key0 never replaces a backend error with its own error shape (e.g. no 502 wrapping of backend 500s).

### Discovery Endpoint

`GET /discovery` returns both plans and routes. The response is unwrapped (no `discoveryResponse` wrapper — this is a fix from the current branch):

```json
{
  "agentName": "Weather API",
  "plans": [
    { "planId": "premium", "unitAmount": "$5.00", "description": "Monthly access" }
  ],
  "routes": [
    {
      "routeId": "weather",
      "method": "GET",
      "path": "/api/weather/:city",
      "unitAmount": "$0.01",
      "description": "Get current weather for a city"
    },
    {
      "routeId": "health",
      "method": "GET",
      "path": "/health"
    }
  ]
}
```

Free routes have no `unitAmount` field. The gateway does not add a computed `free: true` field — absence of `unitAmount` indicates a free route.

### Embedded Mode — API Rename

Sellers using `key0.payPerRequest()` middleware directly on their Express/Hono/Fastify app continue to work. The parameter is renamed from `planId` to `routeId` (breaking change within the branch; not a main-branch change). The middleware resolves the `routeId` against `SellerConfig.routes`.

```typescript
app.get("/api/weather/:city", key0.payPerRequest("weather"), handler);
// req.key0Payment contains payment metadata
```

This mode remains HTTP-only (no A2A/MCP). It is for greenfield sellers who own the app and prefer middleware-style gating. In this case, `proxyTo` is not needed.

---

## Docker Setup UI (Dashboard)

The existing setup UI at `/setup` currently allows sellers to configure plans and basic server settings. It must be updated to support the new `routes` concept alongside `plans`, and to make the distinction between the two concepts clear to sellers.

### What the UI Must Express

The UI has two distinct configuration sections:

**Plans (subscription tiers)**
- Each plan has: Plan ID, Price (monthly), Description
- After payment, Key0 issues a JWT. The seller's own backend decides what the JWT unlocks.
- UI hint: "Clients pay once and get a token for ongoing access."

**Routes (per-request APIs)**
- Each route has: Route ID, HTTP Method, Path, Price per call (leave blank for free), Description
- Key0 auto-gates each route. No JWT issued. Clients pay per call.
- UI hint: "Each API call is individually priced. Key0 proxies requests to your backend."
- Requires the "Backend URL" field (proxyTo.baseUrl) to be filled in.

**Gateway settings** (shown when any routes are configured)
- Backend URL (`proxyTo.baseUrl`) — required
- Internal secret (`proxyTo.proxySecret`) — optional but recommended; shown with explanation of how the backend should validate it

### UX Principles

- **Two tabs or two clearly labelled sections** — "Plans" and "Routes" — so sellers immediately understand these are distinct concepts
- **Contextual help inline**: for each section, one sentence explaining when to use it
  - Plans: "Use when you want clients to subscribe for ongoing access (e.g. monthly API key)"
  - Routes: "Use when you want to charge per API call and proxy requests to your backend"
- **Backend URL field is prominent** when routes are configured — it's easy for sellers to miss that `proxyTo` is required
- **Free route is zero-friction**: if Price is left blank, the route is free. No separate toggle needed.
- **Live preview of the discovery response** — sellers can see exactly what agent clients will discover, updating as they type

### Setup API Changes (`/api/setup`)

The `/api/setup/status` and `/api/setup/save` endpoints currently pass `plans` as a JSON array. They need to also pass `routes` and `proxyTo` config:

```typescript
// GET /api/setup/status — add to response:
{
  routes: Route[];           // from ROUTES_B64 or ROUTES env var
  proxyToBaseUrl: string;    // from PROXY_TO_BASE_URL env var
  proxySecret: string;       // from KEY0_PROXY_SECRET env var (masked)
}

// POST /api/setup/save — add to body:
{
  routes: Route[];
  proxyToBaseUrl: string;
  proxySecret?: string;
}
```

The Docker server reads `routes` from a `ROUTES_B64` env var (base64 JSON), matching the existing pattern for `PLANS_B64`.

---

## Backward Compatibility

This is a **breaking change** to the `feat/pay-per-request` branch (not to `main`). The following are removed:

| Removed | Replacement |
|---|---|
| `Plan.mode` | Separate `routes` array |
| `Plan.free` | Route with no `unitAmount` |
| `Plan.proxyPath` | `Route.path` |
| `Plan.proxyMethod` | `Route.method` |
| `Plan.proxyQuery` | Seller backend responsibility |
| `Plan.routes` | Top-level `SellerConfig.routes` |
| `SellerConfig.fetchResource` | `proxyTo` (custom logic moves to backend) |
| `key0.payPerRequest(planId)` | `key0.payPerRequest(routeId)` (parameter rename) |
| `discoveryResponse` wrapper on `GET /discovery` | Unwrapped response object |

The subscription flow (`Plan` → payment → JWT) is **unchanged**. Sellers using only subscription plans today are unaffected.

---

## E2E Test Cases

### Transparent Proxy — Paid Route

1. **Happy path:** Client sends `GET /api/weather/london` with valid `PAYMENT-SIGNATURE` → backend receives request with `x-key0-tx-hash` and `x-key0-internal-token` headers → client receives raw backend response unchanged (status, headers, body)
2. **No payment header:** `GET /api/weather/london` without signature → `402 Payment Required` with payment requirements
3. **Invalid signature:** Invalid `PAYMENT-SIGNATURE` → `402` with error detail
4. **Double spend:** Reuse same `txHash` → `402` rejected
5. **Backend non-2xx:** Backend returns `500` with error body → refund initiated → client receives `500` with exact backend body unchanged
6. **Backend timeout:** Backend takes >30s → refund initiated → client receives `504`
7. **Path parameters forwarded correctly:** Route `GET /api/weather/:city`, request `GET /api/weather/london` → backend receives `GET /api/weather/london` (not `/api/weather/:city`)
8. **Query parameters forwarded:** `GET /api/weather/london?units=metric` → backend receives `?units=metric` unchanged

### Transparent Proxy — Free Route

9. **Happy path:** Client sends `GET /health` with no headers → proxied directly → raw backend response returned
10. **With spurious payment header:** Header is ignored, route still proxies freely

### A2A — Routes

11. **Paid route via A2A:** `POST /x402/access` with `routeId` + `PAYMENT-SIGNATURE` → `ResourceResponse` with `resource.body` matching backend response
12. **Free route via A2A:** `POST /x402/access` with `routeId` for free route, no payment needed → `ResourceResponse` with no `txHash`
13. **Unknown routeId:** → `404` error response
14. **Backend non-2xx via A2A:** → refund initiated → `ResourceResponse` with `resource.status` = backend status, `resource.body` = backend body unchanged
15. **`planId` and `routeId` both present:** → `400` error (ambiguous request)

### MCP Tools

16. **`discover_api` tool:** Returns both plans and routes with correct schema; free routes have no `unitAmount`
17. **`request_access` with routeId — paid:** Settles payment → `ResourceResponse`
18. **`request_access` with routeId — free:** No payment → `ResourceResponse`
19. **`request_access` with planId:** Subscription flow unchanged → `AccessGrant` JWT

### Subscription Plans (Regression)

20. **Subscription happy path:** `POST /x402/access` with `planId` → `AccessGrant` JWT (unchanged)
21. **`validateAccessToken` middleware:** JWT from subscription plan still accepted on protected routes

### Config Validation

22. **routes without proxyTo:** Startup throws clear error message
23. **plans without fetchResourceCredentials:** Startup throws clear error message
24. **Route with no unitAmount:** Treated as free, `402` never returned
25. **Both plans and routes configured:** Both work independently on the same server

### Coexistence

26. **Seller with both plans and routes:** Subscription clients and per-request clients coexist
27. **Discovery returns both:** `GET /discovery` includes both `plans` and `routes` arrays, no wrapper

### Docker Setup UI

28. **Routes persist across restart:** Routes saved via `/api/setup/save` are written to `ROUTES_B64` and survive container restart
29. **Discovery reflects saved routes:** After saving routes via UI, `GET /discovery` returns them correctly
30. **Free route in UI:** Route saved with blank price → discovery shows no `unitAmount` → transparent proxy requires no payment

---

## Documentation Updates

### README

- Replace "plans" section with two sections: **Subscription Plans** and **Per-Request Routes**
- Add quickstart snippet showing `routes` config alongside `proxyTo` for the gateway pattern
- Add comparison table: subscription vs per-request vs free route
- Update Docker quickstart to show the setup UI's two-section layout

### Mintlify

- **`introduction/two-modes.mdx`** — Update to describe embedded vs gateway; clarify gateway supports HTTP + A2A + MCP for all routes
- **`introduction/core-concepts.mdx`** — Add `Route` as a first-class concept alongside `Plan`; explain the distinction
- **`sdk-reference/seller-config.mdx`** — Add `routes` field, update `plans` to subscription-only, mark all removed fields with migration notes
- **`api-reference/data-models.mdx`** — Add `Route` type; update `Plan` type; update `ResourceResponse` with optional `routeId`/`txHash`; fix discovery response shape (remove wrapper)
- **`examples/ppr-embedded.mdx`** — Update `planId` → `routeId` in `payPerRequest()` call
- **`examples/ppr-standalone.mdx`** — Full rewrite: show top-level `routes` array, transparent proxy behavior, A2A + MCP access, no response wrapper
- **New: `guides/routes-vs-plans.mdx`** — When to use routes vs plans; how sellers use `validateAccessToken` to control subscription access; free route pattern
- **`architecture/payment-flow.mdx`** — Add transparent proxy path alongside the existing A2A/subscription flows
- **`deployment/environment-variables.mdx`** — Add `ROUTES_B64`, update `PLANS_B64` notes
- **`deployment/docker.mdx`** — Update setup UI walkthrough to show Plans + Routes tabs

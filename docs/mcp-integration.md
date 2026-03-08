# MCP Integration — Technical Deep Dive

## What This File Does

`src/integrations/mcp.ts` exposes AgentGate's payment-gated products as MCP (Model Context Protocol) tools. Any MCP client — Claude Desktop, Cursor, Claude Code, or custom agents — can discover products, get pricing, and request paid access through a standard protocol.

It has two exports:

1. **`createMcpServer(engine, config)`** — Creates an `McpServer` instance with two tools registered.
2. **`mountMcpRoutes(router, engine, config)`** — Mounts the MCP transport + discovery endpoint onto an Express Router.

---

## Architecture

```
MCP Client (Claude/Cursor)
    │
    │  POST /mcp  (JSON-RPC over HTTP)
    ▼
┌──────────────────────────────────┐
│  Express Router                  │
│  └─ POST /mcp handler           │
│       │                          │
│       ├─ new McpServer()         │  ← fresh per request (stateless)
│       ├─ new Transport({})       │
│       ├─ server.connect(transport)
│       └─ transport.handleRequest()
│            │                     │
│            ▼                     │
│       Tool dispatch              │
│       ├─ discover_products       │  ← reads config.products
│       └─ request_product_access  │  ← calls ChallengeEngine
│            │                     │
│            ▼                     │
│       ChallengeEngine            │  ← shared instance, backed by Redis stores
└──────────────────────────────────┘
```

---

## Transport Type: Streamable HTTP

### What are MCP transports?

MCP defines how clients and servers exchange JSON-RPC messages. The SDK supports three transports:

| Transport | How it works | Use case |
|-----------|-------------|----------|
| **stdio** | stdin/stdout pipes | Local CLI tools. Client launches server as a subprocess. |
| **SSE** (legacy) | HTTP POST for requests, Server-Sent Events for responses | Older remote servers. Being deprecated. |
| **Streamable HTTP** | HTTP POST for everything, optional SSE for streaming | Remote servers. Current standard (2025+). |

### Why Streamable HTTP?

We chose Streamable HTTP because:

1. **Remote access** — Our server runs on a URL, not as a local subprocess. stdio is impossible.
2. **Standard HTTP** — Works behind load balancers, proxies, CDNs. No WebSocket upgrade needed.
3. **Client compatibility** — Claude Desktop, Cursor, and Claude Code all support `"type": "http"` which maps to Streamable HTTP.
4. **Mounts on Express** — Fits naturally into the existing Express Router pattern alongside A2A and x402 routes.
5. **SSE is optional** — We don't need server-initiated streaming (our tools are request/response), so we run in JSON-response mode. The transport handles this automatically.

### How Streamable HTTP works

```
Client                          Server
  │                                │
  │  POST /mcp                     │
  │  Content-Type: application/json│
  │  Accept: application/json,     │
  │          text/event-stream     │
  │  Body: {jsonrpc, method, ...}  │
  │ ─────────────────────────────► │
  │                                │
  │  200 OK                        │
  │  Content-Type: application/json│  ← JSON mode (no streaming)
  │  Body: {jsonrpc, result, ...}  │
  │ ◄───────────────────────────── │
```

The `Accept` header is mandatory and must include both `application/json` and `text/event-stream`. The server chooses which format to respond with. For our simple request/response tools, it always picks `application/json`.

If the server needed to stream (e.g., progress updates), it would respond with `text/event-stream` and send SSE events. We don't use this.

---

## Stateless Mode — Why and How

### The decision

MCP supports two modes:

| Mode | Session tracking | Server memory | Scaling |
|------|-----------------|---------------|---------|
| **Stateful** | Server assigns session ID, client sends it back | Transport + McpServer persist in memory per session | Needs sticky sessions or session store |
| **Stateless** | No session ID | Fresh McpServer + Transport per request | Scales horizontally, no cleanup needed |

We chose **stateless** because:

- Our tools are pure request/response — no conversation state, no streaming, no server-initiated notifications.
- AgentGate's state lives in Redis (ChallengeStore, SeenTxStore), not in the MCP layer.
- Stateless scales horizontally without sticky sessions or session affinity.
- No memory leaks from abandoned sessions.

### What "stateless" means in code

```ts
// Every POST /mcp creates BOTH a new McpServer and new Transport
router.post("/mcp", async (req, res) => {
    const server = createMcpServer(engine, config);      // new server
    const transport = new StreamableHTTPServerTransport({}); // new transport, no sessionIdGenerator
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});
```

The MCP SDK enforces this: `"Stateless transport cannot be reused across requests."` If you try to reuse a stateless transport, it throws.

### Does the client maintain a persistent connection?

**No.** In stateless Streamable HTTP mode:

- Each tool call is an independent HTTP POST.
- No WebSocket, no long-lived connection, no keep-alive requirement.
- The client (Claude/Cursor) sends `initialize` → gets response → sends `tools/list` → gets response → sends `tools/call` → gets response. Each is a separate HTTP request.
- The client may re-initialize on every interaction since there's no session to resume.

This is identical to calling a REST API — fire and forget per request.

---

## The Two Tools

### `discover_products`

**Purpose:** Let an MCP client (AI agent) discover what's for sale.

**Input:** None.

**Output:** JSON with the full product catalog:
```json
{
  "agent": "AgentGate Service",
  "description": "Payment-gated API access",
  "network": "testnet",
  "chainId": 84532,
  "walletAddress": "0x...",
  "asset": "USDC",
  "products": [
    { "tierId": "basic", "label": "Basic Access", "amount": "$0.99", ... }
  ]
}
```

**Implementation:** Pure config read. No side effects, no database calls. Reads from `config.products` and `CHAIN_CONFIGS[config.network]`.

### `request_product_access`

**Purpose:** Two-step payment flow mirroring the x402 HTTP endpoint.

**Step 1 — Get payment requirements** (no `txHash`):
- Calls `engine.requestHttpAccess(requestId, tierId, resourceId)`
- Creates a PENDING challenge record in the store
- Returns payment details: amount, wallet, chainId, `x402PaymentUrl`
- The `x402PaymentUrl` tells x402-capable clients (like payments-mcp) exactly which endpoint to hit

**Step 2 — Claim access token** (with `txHash`):
- Calls `engine.processHttpPayment(requestId, tierId, resourceId, txHash, fromAddress)`
- Verifies the on-chain payment, transitions challenge PENDING → PAID → DELIVERED
- Returns the AccessGrant with JWT token

**Error handling:**
- `PROOF_ALREADY_REDEEMED` → Returns the cached grant (idempotent)
- Other `AgentGateError` → Returns error JSON with `isError: true`
- Unknown errors → Re-thrown (caught by transport, returned as JSON-RPC error)

---

## Route Breakdown

### `GET /.well-known/mcp.json` — Discovery

Returns a JSON document telling MCP clients where to connect:
```json
{
  "name": "AgentGate Service",
  "description": "...",
  "version": "1.0.0",
  "transport": {
    "type": "streamable-http",
    "url": "https://yourserver.com/mcp"
  }
}
```

Clients like Cursor can auto-discover tools by fetching this URL.

### `POST /mcp` — The actual MCP endpoint

Handles all JSON-RPC messages: `initialize`, `tools/list`, `tools/call`, `notifications/initialized`, etc. The `StreamableHTTPServerTransport` parses the JSON-RPC envelope and dispatches to the right handler.

### `GET /mcp` — 405

In stateful mode, GET is used for SSE (server-to-client push). We don't support it — return 405.

### `DELETE /mcp` — 405

In stateful mode, DELETE closes a session. We don't have sessions — return 405.

---

## Concerns and Potential Issues

### 1. Object allocation per request

Every POST creates a new `McpServer` + `StreamableHTTPServerTransport` + re-registers both tools. This involves:
- ~2 object allocations (server + transport)
- ~2 `registerTool` calls (adds handlers to internal maps)
- Zod schema compilation for input validation

**Why this is required:** The MCP SDK enforces that a stateless transport cannot be reused across requests — it throws `"Stateless transport cannot be reused"`. And an `McpServer` can only be connected to one transport at a time. So in stateless mode, both must be fresh per request. This is a deliberate SDK design: stateless means no shared mutable state between requests, which eliminates an entire class of concurrency bugs (session mixups, response routing to wrong client, etc.).

**Why this is fine for us:** AgentGate's MCP tools are a discovery + purchase flow — an agent calls `discover_products` once, then `request_product_access` once or twice. That's 2-3 MCP requests per purchase. Even at 100 concurrent purchases, that's 300 object allocations — trivial. The expensive work (on-chain verification, Redis store operations) happens inside the `ChallengeEngine`, which is a single shared instance closed over by all requests. The per-request McpServer is just a thin JSON-RPC dispatch layer on top.

The only scenario where this matters is thousands of MCP tool calls per second, which would mean switching to stateful mode with session pooling — a different architecture entirely.

### 2. Request ID collisions

Each `request_product_access` call generates `mcp-${crypto.randomUUID()}`. This means:
- Step 1 and Step 2 use **different** requestIds (each call is independent)
- The engine's idempotency check (`findActiveByRequestId`) won't link them
- Step 2 with `txHash` creates a new PENDING record, then immediately processes payment

This works because `processHttpPayment` handles the full lifecycle (create + verify + deliver) in one call. But it means step 1's PENDING record is orphaned and will expire via TTL.

**Impact:** Wasted challenge records. Not a correctness issue, but adds noise to the store. Acceptable for the MCP use case where most flows will go through x402 payment URL directly (the `x402PaymentUrl` in the response guides clients to use the HTTP endpoint instead).

### 3. Missing `Content-Type` validation

The MCP SDK's `StreamableHTTPServerTransport` validates headers internally:
- Rejects if `Accept` doesn't include both `application/json` and `text/event-stream` (returns 406)
- Rejects if `Content-Type` isn't `application/json` (returns 415)

This means raw `curl` calls without the right headers will fail silently with MCP-level errors. Not a bug, but can confuse developers during testing. The correct curl requires:
```
-H "Accept: application/json, text/event-stream"
-H "Content-Type: application/json"
```


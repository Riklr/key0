# @agentgate/sdk

Framework adapters for integrating AgentGate into Express, Hono, or Fastify applications.

## Install

```bash
bun add @agentgate/sdk @agentgate/x402-adapter
```

## Framework Adapters

### Express

```typescript
import { agentGateRouter, validateAccessToken } from "@agentgate/sdk/express";

app.use(agentGateRouter({ config, adapter }));
app.use("/api", validateAccessToken({ secret: config.accessTokenSecret }));
```

### Hono

```typescript
import { agentGateApp, honoValidateAccessToken } from "@agentgate/sdk/hono";

const gate = agentGateApp({ config, adapter });
app.route("/", gate);

const api = new Hono();
api.use("/*", honoValidateAccessToken({ secret: config.accessTokenSecret }));
app.route("/api", api);
```

### Fastify

```typescript
import { agentGatePlugin, fastifyValidateAccessToken } from "@agentgate/sdk/fastify";

await fastify.register(agentGatePlugin, { config, adapter });
fastify.addHook("onRequest", fastifyValidateAccessToken({ secret: config.accessTokenSecret }));
```

## What Each Adapter Serves

- `GET /.well-known/agent.json` - A2A agent card for discovery
- `POST /agent` (configurable via `config.basePath`) - A2A task endpoint

## Subpath Imports

Each framework adapter is a separate subpath export to avoid pulling in unnecessary dependencies:

```json
{
  "@agentgate/sdk": "core router + middleware",
  "@agentgate/sdk/express": "Express adapter",
  "@agentgate/sdk/hono": "Hono adapter",
  "@agentgate/sdk/fastify": "Fastify adapter"
}
```

Framework packages (`express`, `hono`, `fastify`) are optional peer dependencies.

See the [root README](../../README.md) for full documentation.

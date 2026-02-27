# @agentgate/core

Core business logic for AgentGate: challenge engine, access token issuer, and storage implementations.

## Install

```bash
bun add @agentgate/core
```

## Key Exports

### ChallengeEngine

Orchestrates the full challenge-response flow: access requests, payment verification, token issuance.

```typescript
import { ChallengeEngine, AccessTokenIssuer, InMemoryChallengeStore, InMemorySeenTxStore } from "@agentgate/core";

const engine = new ChallengeEngine({
  config: sellerConfig,
  store: new InMemoryChallengeStore(),
  seenTxStore: new InMemorySeenTxStore(),
  adapter: paymentAdapter,
  tokenIssuer: new AccessTokenIssuer(config.accessTokenSecret),
});

const challenge = await engine.requestAccess(accessRequest);
const grant = await engine.submitProof(paymentProof);
```

### AccessTokenIssuer

Signs and verifies HS256 JWTs. Supports secret rotation via `verifyWithFallback()`.

```typescript
import { AccessTokenIssuer } from "@agentgate/core";

const issuer = new AccessTokenIssuer("your-secret-32-chars-minimum!!");
const { token, expiresAt } = await issuer.sign(claims, 3600);
const decoded = await issuer.verify(token);

// Secret rotation: try primary, then fallbacks
const decoded = await issuer.verifyWithFallback(token, [oldSecret1, oldSecret2]);
```

### Storage

**In-Memory** (default, single-process):
- `InMemoryChallengeStore` - With TTL-based cleanup and size guards
- `InMemorySeenTxStore` - Double-spend prevention

**Redis** (production, multi-process):
- `RedisChallengeStore` - Lua-scripted atomic transitions
- `RedisSeenTxStore` - SET NX for atomic double-spend guard

```typescript
import { RedisChallengeStore, RedisSeenTxStore } from "@agentgate/core";
import Redis from "ioredis";

const redis = new Redis();
const store = new RedisChallengeStore({ redis, challengeTTLSeconds: 900 });
const seenTxStore = new RedisSeenTxStore({ redis });
```

Redis is an optional peer dependency (`ioredis ^5.0.0`).

See the [root README](../../README.md) for full documentation.

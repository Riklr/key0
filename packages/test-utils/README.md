# @agentgate/test-utils

Mock adapter and test fixtures for testing AgentGate integrations. Not published to npm.

## Usage

```typescript
import { MockPaymentAdapter, makeSellerConfig, makeAccessRequest, makeChallengeRecord } from "@agentgate/test-utils";
import { InMemoryChallengeStore, InMemorySeenTxStore } from "@agentgate/core";
```

### MockPaymentAdapter

Drop-in replacement for `IPaymentAdapter` that returns configurable results without hitting the blockchain.

```typescript
const adapter = new MockPaymentAdapter();

// Override verification result
adapter.setVerifyResult({
  verified: false,
  error: "Wrong recipient",
  errorCode: "WRONG_RECIPIENT",
});
```

### Fixtures

- `makeSellerConfig(overrides?)` - Create a valid `SellerConfig` with sensible defaults
- `makeAccessRequest(overrides?)` - Create a valid `AccessRequest`
- `makeChallengeRecord(overrides?)` - Create a valid `ChallengeRecord`

Storage classes (`InMemoryChallengeStore`, `InMemorySeenTxStore`) should be imported directly from `@agentgate/core`.

See the [root README](../../README.md) for full documentation.

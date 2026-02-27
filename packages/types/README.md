# @agentgate/types

Shared TypeScript types and interfaces for the AgentGate ecosystem. This is a types-only package with no runtime code.

## Install

```bash
bun add @agentgate/types
```

## Exported Types

### Configuration
- `SellerConfig` - Full seller configuration (identity, payment, products, hooks)
- `ProductTier` - Product tier definition (tierId, label, amount, resourceType)
- `NetworkName` - `"mainnet" | "testnet"`
- `NetworkConfig` - Chain-specific configuration (chainId, rpcUrl, USDC address)

### Challenge Flow
- `AccessRequest` - Client's request for access to a resource
- `PaymentProof` - Client's proof of on-chain payment
- `X402Challenge` - Server's payment challenge response
- `AccessGrant` - Server's access grant with JWT token
- `ChallengeRecord` - Internal challenge state (PENDING, PAID, EXPIRED, CANCELLED)

### Interfaces
- `IPaymentAdapter` - Payment adapter interface (issueChallenge, verifyProof)
- `IChallengeStore` - Challenge storage interface (create, get, transition, findActiveByRequestId)
- `ISeenTxStore` - Double-spend guard interface (get, markUsed)

### Errors
- `AgentGateError` - Typed error class with HTTP status codes
- `AgentGateErrorCode` - Union of all error codes (RESOURCE_NOT_FOUND, CHALLENGE_EXPIRED, etc.)

### A2A Protocol
- `A2ATaskSendRequest` - JSON-RPC 2.0 task send request
- `AgentCard` - A2A agent card for discovery

See the [root README](../../README.md) for full documentation.

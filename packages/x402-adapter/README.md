# @agentgate/x402-adapter

On-chain USDC payment verification adapter for AgentGate, using [viem](https://viem.sh) to interact with Base and Base Sepolia.

## Install

```bash
bun add @agentgate/x402-adapter
```

## Usage

```typescript
import { X402Adapter } from "@agentgate/x402-adapter";

const adapter = new X402Adapter({
  network: "testnet", // or "mainnet"
  rpcUrl: "https://sepolia.base.org", // optional override
});
```

Pass the adapter to `ChallengeEngine` or any SDK framework adapter:

```typescript
import { agentGateRouter } from "@agentgate/sdk/express";

app.use(agentGateRouter({ config, adapter }));
```

## What It Does

- **`issueChallenge()`** - Generates a unique challenge ID for payment
- **`verifyProof()`** - Verifies a transaction on-chain:
  - Fetches the transaction receipt
  - Checks for reverted status
  - Decodes USDC Transfer events
  - Validates recipient, amount, and timing
  - Returns detailed error codes on failure

## Supported Networks

| Network | Chain | Chain ID | USDC Contract |
|---------|-------|----------|---------------|
| testnet | Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| mainnet | Base | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Error Codes

`TX_NOT_FOUND`, `TX_REVERTED`, `WRONG_RECIPIENT`, `AMOUNT_INSUFFICIENT`, `CHAIN_MISMATCH`, `TX_AFTER_EXPIRY`, `NO_TRANSFER_EVENT`, `RPC_ERROR`

See the [root README](../../README.md) for full documentation.

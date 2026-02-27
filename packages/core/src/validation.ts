import { AgentGateError } from "@agentgate/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const DOLLAR_RE = /^\$\d+(\.\d{1,6})?$/;

const USDC_DECIMALS = 6;

export function validateUUID(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new AgentGateError("INVALID_REQUEST", `${label} must be a valid UUID`, 400);
  }
}

export function validateTxHash(value: string): asserts value is `0x${string}` {
  if (!TX_RE.test(value)) {
    throw new AgentGateError(
      "INVALID_REQUEST",
      "txHash must be a 0x-prefixed 64-char hex string",
      400,
    );
  }
}

export function validateAddress(value: string): asserts value is `0x${string}` {
  if (!ADDR_RE.test(value)) {
    throw new AgentGateError(
      "INVALID_REQUEST",
      "Address must be a 0x-prefixed 40-char hex string",
      400,
    );
  }
}

export function validateNonEmpty(value: string, label: string): void {
  if (!value || value.trim().length === 0) {
    throw new AgentGateError("INVALID_REQUEST", `${label} must not be empty`, 400);
  }
}

export function validateDollarAmount(value: string, label: string): void {
  if (!DOLLAR_RE.test(value)) {
    throw new AgentGateError(
      "INVALID_REQUEST",
      `${label} must be a dollar amount (e.g. "$0.10")`,
      400,
    );
  }
}

/**
 * Convert a "$X.XX" string to USDC micro-units (bigint).
 * "$0.10" → 100000n
 * "$1.00" → 1000000n
 */
export function parseDollarToUsdcMicro(amount: string): bigint {
  const cleaned = amount.replace("$", "").trim();
  const parts = cleaned.split(".");
  const whole = BigInt(parts[0] ?? "0");
  const fracStr = (parts[1] ?? "").padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  const frac = BigInt(fracStr);
  return whole * BigInt(10 ** USDC_DECIMALS) + frac;
}

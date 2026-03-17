/**
 * Pre-flight wallet balance check.
 *
 * Checks that each test wallet has enough funds to run the full suite.
 * Fails fast with faucet URLs if any wallet is under-funded.
 *
 *   CLIENT wallet — needs ≥ $1.00 USDC for test purchases.
 *   KEY0 wallet   — needs ≥ $0.10 USDC for refund tests (cron sends USDC
 *                   FROM KEY0 back to the payer).
 *   GAS wallet    — needs ≥ 0.002 ETH (gas for on-chain txs) AND
 *                   ≥ $0.20 USDC (concurrent-purchases uses GAS wallet as a
 *                   second buyer via makeGasE2eClient).
 *
 * Faucets:
 *   USDC (Base Sepolia): https://faucet.circle.com
 *   ETH  (Base Sepolia): https://www.alchemy.com/faucets/base-sepolia
 *
 * Exit codes:
 *   0  All balances OK — proceed with test suite
 *   1  One or more wallets are under-funded — abort CI
 */

import { createPublicClient, formatUnits, http, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC_ADDRESS } from "./fixtures/constants.ts";

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Minimum USDC for the CLIENT wallet (buyer in most tests). */
const CLIENT_MIN_USDC = parseUnits("1.00", 6);

/** Minimum USDC for the KEY0 wallet (refund source). */
const KEY0_MIN_USDC = parseUnits("0.10", 6);

/** Minimum USDC for the GAS wallet (second buyer in concurrent-purchases). */
const GAS_MIN_USDC = parseUnits("0.20", 6);

/** Minimum ETH for each wallet to cover gas fees. */
const MIN_ETH_WEI = parseUnits("0.002", 18);

// ─── Minimal ERC-20 ABI ───────────────────────────────────────────────────────

const ERC20_ABI = [
	{
		name: "balanceOf",
		type: "function",
		stateMutability: "view",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
	},
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
	const val = process.env[name];
	if (!val) throw new Error(`Missing required env var: ${name}`);
	return val;
}

function fmtUsdc(raw: bigint): string {
	return `$${formatUnits(raw, 6)} USDC`;
}

function fmtEth(raw: bigint): string {
	return `${formatUnits(raw, 18)} ETH`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const rpcUrl = process.env["ALCHEMY_BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org";

const clientAddress = requireEnv("CLIENT_WALLET_ADDRESS") as `0x${string}`;
const key0Address = requireEnv("KEY0_WALLET_ADDRESS") as `0x${string}`;
const gasWalletAddress = requireEnv("GAS_WALLET_ADDRESS") as `0x${string}`;

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });

async function getUsdc(address: `0x${string}`): Promise<bigint> {
	return publicClient.readContract({
		address: USDC_ADDRESS,
		abi: ERC20_ABI,
		functionName: "balanceOf",
		args: [address],
	});
}

async function getEth(address: `0x${string}`): Promise<bigint> {
	return publicClient.getBalance({ address });
}

console.log("─── Pre-flight wallet check ───────────────────────────────");

const [clientUsdc, clientEth, key0Usdc, key0Eth, gasUsdc, gasEth] = await Promise.all([
	getUsdc(clientAddress),
	getEth(clientAddress),
	getUsdc(key0Address),
	getEth(key0Address),
	getUsdc(gasWalletAddress),
	getEth(gasWalletAddress),
]);

console.log(`CLIENT  ${clientAddress}  USDC: ${fmtUsdc(clientUsdc)}  ETH: ${fmtEth(clientEth)}`);
console.log(`KEY0    ${key0Address}  USDC: ${fmtUsdc(key0Usdc)}  ETH: ${fmtEth(key0Eth)}`);
console.log(`GAS     ${gasWalletAddress}  USDC: ${fmtUsdc(gasUsdc)}  ETH: ${fmtEth(gasEth)}`);
console.log("───────────────────────────────────────────────────────────");

let failed = false;

// ── CLIENT USDC ───────────────────────────────────────────────────────────────
if (clientUsdc < CLIENT_MIN_USDC) {
	console.error(
		`✗  CLIENT USDC too low (${fmtUsdc(clientUsdc)}, need ${fmtUsdc(CLIENT_MIN_USDC)})`,
	);
	console.error(`   Top up via https://faucet.circle.com`);
	failed = true;
} else {
	console.log(`✓  CLIENT USDC OK (${fmtUsdc(clientUsdc)})`);
}

// ── KEY0 USDC ─────────────────────────────────────────────────────────────────
if (key0Usdc < KEY0_MIN_USDC) {
	console.error(`✗  KEY0 USDC too low (${fmtUsdc(key0Usdc)}, need ${fmtUsdc(KEY0_MIN_USDC)})`);
	console.error(`   Top up via https://faucet.circle.com`);
	failed = true;
} else {
	console.log(`✓  KEY0 USDC OK (${fmtUsdc(key0Usdc)})`);
}

// ── GAS USDC (used as second buyer in concurrent-purchases) ──────────────────
if (gasUsdc < GAS_MIN_USDC) {
	console.error(`✗  GAS USDC too low (${fmtUsdc(gasUsdc)}, need ${fmtUsdc(GAS_MIN_USDC)})`);
	console.error(`   Top up via https://faucet.circle.com`);
	failed = true;
} else {
	console.log(`✓  GAS USDC OK (${fmtUsdc(gasUsdc)})`);
}

// ── ETH checks (all wallets need ETH for gas) ─────────────────────────────────
for (const [name, bal] of [
	["CLIENT", clientEth],
	["KEY0", key0Eth],
	["GAS", gasEth],
] as const) {
	if (bal < MIN_ETH_WEI) {
		console.error(`✗  ${name} ETH too low (${fmtEth(bal)}, need ${fmtEth(MIN_ETH_WEI)})`);
		console.error(`   Top up via https://www.alchemy.com/faucets/base-sepolia`);
		failed = true;
	}
}

console.log("───────────────────────────────────────────────────────────");

if (failed) {
	console.error("Pre-flight failed — fund the wallets above and re-run.");
	process.exit(1);
}

console.log("Pre-flight passed.");

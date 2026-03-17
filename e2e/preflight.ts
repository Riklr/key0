/**
 * Pre-flight wallet balance check with auto-funding.
 *
 * Checks that each test wallet has enough funds to run the full suite.
 * If a wallet is under-funded, calls the Circle faucet API to top it up,
 * then polls until the balance is confirmed on-chain.
 * Fails fast if funding fails or balances remain insufficient.
 *
 *   CLIENT wallet — needs ≥ $1.00 USDC. Uses EIP-3009 gasless signatures;
 *                   GAS wallet pays on-chain gas, so no ETH needed here.
 *   KEY0 wallet   — needs ≥ $0.10 USDC for refund tests (GAS wallet submits
 *                   refund txs on KEY0's behalf, so no ETH needed here).
 *   GAS wallet    — needs ≥ 0.002 ETH (submits all on-chain txs) AND
 *                   ≥ $0.20 USDC (second buyer in concurrent-purchases).
 *
 * Circle faucet (BASE-SEPOLIA):
 *   POST https://api.circle.com/v1/faucet/drips
 *   Drips $20 USDC and/or 0.01 ETH per call.
 *   Requires CIRCLE_API_KEY env var.
 *
 * Exit codes:
 *   0  All balances OK — proceed with test suite
 *   1  One or more wallets are under-funded and could not be topped up
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

/** Minimum ETH for the GAS wallet (it submits all on-chain transactions). */
const GAS_MIN_ETH = parseUnits("0.002", 18);

// ─── Circle faucet ────────────────────────────────────────────────────────────

const CIRCLE_FAUCET_URL = "https://api.circle.com/v1/faucet/drips";
const CIRCLE_BLOCKCHAIN = "BASE-SEPOLIA";

/** Poll interval and max wait after a faucet drip. */
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 60_000;

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const rpcUrl = process.env["ALCHEMY_BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org";
const circleApiKey = process.env["CIRCLE_API_KEY"];

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

/**
 * Call the Circle faucet for the given wallet.
 * @param usdc    Whether to drip USDC
 * @param native  Whether to drip native ETH
 */
async function callCircleFaucet(
	walletName: string,
	address: string,
	usdc: boolean,
	native: boolean,
): Promise<void> {
	if (!circleApiKey) {
		throw new Error(
			"CIRCLE_API_KEY is not set — cannot auto-fund wallets. Set the secret or fund wallets manually.",
		);
	}

	const what = [usdc && "USDC", native && "ETH"].filter(Boolean).join(" + ");
	console.log(`   Calling Circle faucet for ${walletName} (${what})…`);

	const response = await fetch(CIRCLE_FAUCET_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${circleApiKey}`,
		},
		body: JSON.stringify({ blockchain: CIRCLE_BLOCKCHAIN, address, usdc, native }),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => "(no body)");
		throw new Error(`Circle faucet returned ${response.status}: ${text}`);
	}

	console.log(`   ✓ Faucet call accepted for ${walletName}`);
}

/**
 * Poll until the predicate returns true or the timeout expires.
 * Returns true if the condition was met, false on timeout.
 */
async function pollUntil(
	label: string,
	check: () => Promise<boolean>,
	timeoutMs = POLL_MAX_MS,
	intervalMs = POLL_INTERVAL_MS,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await check()) return true;
		console.log(`   … waiting for ${label} (${Math.ceil((deadline - Date.now()) / 1000)}s left)`);
		await sleep(intervalMs);
	}
	return false;
}

// ─── Step 1: Read initial balances ────────────────────────────────────────────

console.log("─── Pre-flight wallet check ───────────────────────────────");

let [clientUsdc, key0Usdc, gasUsdc, gasEth] = await Promise.all([
	getUsdc(clientAddress),
	getUsdc(key0Address),
	getUsdc(gasWalletAddress),
	getEth(gasWalletAddress),
]);

console.log(`CLIENT  ${clientAddress}  USDC: ${fmtUsdc(clientUsdc)}`);
console.log(`KEY0    ${key0Address}  USDC: ${fmtUsdc(key0Usdc)}`);
console.log(`GAS     ${gasWalletAddress}  USDC: ${fmtUsdc(gasUsdc)}  ETH: ${fmtEth(gasEth)}`);
console.log("───────────────────────────────────────────────────────────");

// ─── Step 2: Fund wallets that are below threshold ────────────────────────────

const fundingTasks: Array<Promise<void>> = [];

const clientNeedsUsdc = clientUsdc < CLIENT_MIN_USDC;
if (clientNeedsUsdc) {
	console.log(`⚡ CLIENT USDC low (${fmtUsdc(clientUsdc)}) — requesting faucet drip…`);
	fundingTasks.push(callCircleFaucet("CLIENT", clientAddress, true, false));
}

const key0NeedsUsdc = key0Usdc < KEY0_MIN_USDC;
if (key0NeedsUsdc) {
	console.log(`⚡ KEY0 USDC low (${fmtUsdc(key0Usdc)}) — requesting faucet drip…`);
	fundingTasks.push(callCircleFaucet("KEY0", key0Address, true, false));
}

const gasNeedsUsdc = gasUsdc < GAS_MIN_USDC;
const gasNeedsEth = gasEth < GAS_MIN_ETH;
if (gasNeedsUsdc || gasNeedsEth) {
	const what = [
		gasNeedsUsdc && `USDC low (${fmtUsdc(gasUsdc)})`,
		gasNeedsEth && `ETH low (${fmtEth(gasEth)})`,
	]
		.filter(Boolean)
		.join(", ");
	console.log(`⚡ GAS ${what} — requesting faucet drip…`);
	fundingTasks.push(callCircleFaucet("GAS", gasWalletAddress, gasNeedsUsdc, gasNeedsEth));
}

if (fundingTasks.length > 0) {
	// Faucet calls can run in parallel (one per wallet)
	await Promise.all(fundingTasks);

	// ─── Step 3: Poll until balances are confirmed on-chain ───────────────────
	console.log("─── Polling for on-chain balance confirmation ─────────────");

	const polls: Array<Promise<boolean>> = [];

	if (clientNeedsUsdc) {
		polls.push(
			pollUntil("CLIENT USDC", async () => {
				clientUsdc = await getUsdc(clientAddress);
				return clientUsdc >= CLIENT_MIN_USDC;
			}),
		);
	}

	if (key0NeedsUsdc) {
		polls.push(
			pollUntil("KEY0 USDC", async () => {
				key0Usdc = await getUsdc(key0Address);
				return key0Usdc >= KEY0_MIN_USDC;
			}),
		);
	}

	if (gasNeedsUsdc) {
		polls.push(
			pollUntil("GAS USDC", async () => {
				gasUsdc = await getUsdc(gasWalletAddress);
				return gasUsdc >= GAS_MIN_USDC;
			}),
		);
	}

	if (gasNeedsEth) {
		polls.push(
			pollUntil("GAS ETH", async () => {
				gasEth = await getEth(gasWalletAddress);
				return gasEth >= GAS_MIN_ETH;
			}),
		);
	}

	const results = await Promise.all(polls);
	const allConfirmed = results.every(Boolean);

	// Re-read balances that weren't polled so post-funding display is accurate
	if (!clientNeedsUsdc) clientUsdc = await getUsdc(clientAddress);
	if (!key0NeedsUsdc) key0Usdc = await getUsdc(key0Address);
	if (!gasNeedsUsdc) gasUsdc = await getUsdc(gasWalletAddress);
	if (!gasNeedsEth) gasEth = await getEth(gasWalletAddress);

	console.log("─── Post-funding balances ─────────────────────────────────");
	console.log(`CLIENT  ${clientAddress}  USDC: ${fmtUsdc(clientUsdc)}`);
	console.log(`KEY0    ${key0Address}  USDC: ${fmtUsdc(key0Usdc)}`);
	console.log(`GAS     ${gasWalletAddress}  USDC: ${fmtUsdc(gasUsdc)}  ETH: ${fmtEth(gasEth)}`);
	console.log("───────────────────────────────────────────────────────────");

	if (!allConfirmed) {
		console.error("✗  One or more wallets did not reach the required balance after funding.");
		process.exit(1);
	}
}

// ─── Step 4: Final balance assertions ────────────────────────────────────────

let failed = false;

if (clientUsdc < CLIENT_MIN_USDC) {
	console.error(
		`✗  CLIENT USDC too low (${fmtUsdc(clientUsdc)}, need ${fmtUsdc(CLIENT_MIN_USDC)})`,
	);
	failed = true;
} else {
	console.log(`✓  CLIENT USDC OK (${fmtUsdc(clientUsdc)})`);
}

if (key0Usdc < KEY0_MIN_USDC) {
	console.error(`✗  KEY0 USDC too low (${fmtUsdc(key0Usdc)}, need ${fmtUsdc(KEY0_MIN_USDC)})`);
	failed = true;
} else {
	console.log(`✓  KEY0 USDC OK (${fmtUsdc(key0Usdc)})`);
}

if (gasUsdc < GAS_MIN_USDC) {
	console.error(`✗  GAS USDC too low (${fmtUsdc(gasUsdc)}, need ${fmtUsdc(GAS_MIN_USDC)})`);
	failed = true;
} else {
	console.log(`✓  GAS USDC OK (${fmtUsdc(gasUsdc)})`);
}

if (gasEth < GAS_MIN_ETH) {
	console.error(`✗  GAS ETH too low (${fmtEth(gasEth)}, need ${fmtEth(GAS_MIN_ETH)})`);
	failed = true;
} else {
	console.log(`✓  GAS ETH OK (${fmtEth(gasEth)})`);
}

console.log("───────────────────────────────────────────────────────────");

if (failed) {
	console.error("Pre-flight failed — fund the wallets above and re-run.");
	process.exit(1);
}

console.log("Pre-flight passed.");

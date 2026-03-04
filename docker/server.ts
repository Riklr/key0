/**
 * AgentGate Docker Standalone Server
 *
 * Configured entirely via environment variables.
 * Set AGENTGATE_WALLET_ADDRESS + ISSUE_TOKEN_API and you're done.
 *
 * See docker/.env.example for the full list of env vars.
 */

import {
	type IssueTokenParams,
	type NetworkName,
	type ProductTier,
	RedisChallengeStore,
	RedisSeenTxStore,
	X402Adapter,
} from "@agentgate/sdk";
import { agentGateRouter } from "@agentgate/sdk/express";
import express from "express";

// ─── Required env vars ─────────────────────────────────────────────────────

const WALLET_ADDRESS = process.env.AGENTGATE_WALLET_ADDRESS;
const ISSUE_TOKEN_API = process.env.ISSUE_TOKEN_API;

if (!WALLET_ADDRESS) {
	console.error("FATAL: AGENTGATE_WALLET_ADDRESS is required (e.g. 0xYourWallet...)");
	process.exit(1);
}

if (!ISSUE_TOKEN_API) {
	console.error("FATAL: ISSUE_TOKEN_API is required (e.g. https://api.example.com/issue-token)");
	process.exit(1);
}

// ─── Optional env vars ─────────────────────────────────────────────────────

const NETWORK = (process.env.AGENTGATE_NETWORK ?? "testnet") as NetworkName;
const PORT = Number(process.env.PORT ?? 3000);
const AGENT_NAME = process.env.AGENT_NAME ?? "AgentGate Server";
const AGENT_DESCRIPTION = process.env.AGENT_DESCRIPTION ?? "Payment-gated A2A endpoint";
const AGENT_URL = process.env.AGENT_URL ?? `http://localhost:${PORT}`;
const PROVIDER_NAME = process.env.PROVIDER_NAME ?? "AgentGate";
const PROVIDER_URL = process.env.PROVIDER_URL ?? "https://agentgate.dev";
const BASE_PATH = process.env.BASE_PATH ?? "/a2a";
const CHALLENGE_TTL_SECONDS = Number(process.env.CHALLENGE_TTL_SECONDS ?? 900);
const ISSUE_TOKEN_API_SECRET = process.env.ISSUE_TOKEN_API_SECRET;
const REDIS_URL = process.env.REDIS_URL;
const GAS_WALLET_PRIVATE_KEY = process.env.GAS_WALLET_PRIVATE_KEY as `0x${string}` | undefined;

// ─── Products ──────────────────────────────────────────────────────────────

const DEFAULT_PRODUCTS: ProductTier[] = [
	{
		tierId: "basic",
		label: "Basic",
		amount: "$0.10",
		resourceType: "api",
		accessDurationSeconds: 3600,
	},
];

let products: ProductTier[];
try {
	products = process.env.PRODUCTS
		? (JSON.parse(process.env.PRODUCTS) as ProductTier[])
		: DEFAULT_PRODUCTS;
} catch {
	console.error("FATAL: PRODUCTS env var is not valid JSON");
	process.exit(1);
}

// ─── Storage ───────────────────────────────────────────────────────────────

let store: RedisChallengeStore | undefined;
let seenTxStore: RedisSeenTxStore | undefined;

if (REDIS_URL) {
	const Redis = (await import("ioredis")).default;
	const redis = new Redis(REDIS_URL);
	store = new RedisChallengeStore({ redis, challengeTTLSeconds: CHALLENGE_TTL_SECONDS });
	seenTxStore = new RedisSeenTxStore({ redis });
	console.log("[agentgate] Using Redis storage:", REDIS_URL);
} else {
	console.log("[agentgate] Using in-memory storage (set REDIS_URL for production)");
}

// ─── Token issuance ────────────────────────────────────────────────────────

async function onIssueToken(params: IssueTokenParams) {
	const tier = products.find((p) => p.tierId === params.tierId);

	// Merge IssueTokenParams with the matching product tier (includes custom fields)
	const body = { ...params, ...(tier ?? {}) };

	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (ISSUE_TOKEN_API_SECRET) {
		headers["Authorization"] = `Bearer ${ISSUE_TOKEN_API_SECRET}`;
	}

	const res = await fetch(ISSUE_TOKEN_API!, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		throw new Error(`ISSUE_TOKEN_API returned ${res.status}: ${await res.text()}`);
	}

	const data = (await res.json()) as Record<string, unknown>;

	// Passthrough: if response has a `token` string field, use it directly
	if (typeof data["token"] === "string") {
		const expiresAt =
			typeof data["expiresAt"] === "string"
				? new Date(data["expiresAt"])
				: new Date(Date.now() + (tier?.accessDurationSeconds ?? 3600) * 1000);
		return {
			token: data["token"],
			expiresAt,
			...(typeof data["tokenType"] === "string" ? { tokenType: data["tokenType"] } : {}),
		};
	}

	// No `token` field (e.g. { apiKey, apiSecret }) — JSON-serialize the full response
	const accessDurationSeconds = tier?.accessDurationSeconds ?? 3600;
	return {
		token: JSON.stringify(data),
		expiresAt: new Date(Date.now() + accessDurationSeconds * 1000),
		tokenType: "custom",
	};
}

// ─── App ───────────────────────────────────────────────────────────────────

const adapter = new X402Adapter({ network: NETWORK });

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok", network: NETWORK, wallet: WALLET_ADDRESS });
});

app.use(
	agentGateRouter({
		config: {
			agentName: AGENT_NAME,
			agentDescription: AGENT_DESCRIPTION,
			agentUrl: AGENT_URL,
			providerName: PROVIDER_NAME,
			providerUrl: PROVIDER_URL,
			walletAddress: WALLET_ADDRESS as `0x${string}`,
			network: NETWORK,
			products,
			challengeTTLSeconds: CHALLENGE_TTL_SECONDS,
			basePath: BASE_PATH,
			onVerifyResource: async () => true,
			onIssueToken,
			...(GAS_WALLET_PRIVATE_KEY ? { gasWalletPrivateKey: GAS_WALLET_PRIVATE_KEY } : {}),
		},
		adapter,
		store,
		seenTxStore,
	}),
);

app.listen(PORT, () => {
	console.log("\n[agentgate] Server started");
	console.log(`  Network:    ${NETWORK}`);
	console.log(`  Port:       ${PORT}`);
	console.log(`  Wallet:     ${WALLET_ADDRESS}`);
	console.log(`  Token API:  ${ISSUE_TOKEN_API}`);
	console.log(`  Storage:    ${REDIS_URL ? "Redis" : "in-memory"}`);
	console.log(`  Agent Card: ${AGENT_URL}/.well-known/agent.json\n`);
});

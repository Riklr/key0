/**
 * Standalone PPR gateway — unified via /x402/access.
 *
 * Key0 runs as a separate payment service in front of a backend API.
 * All traffic flows through /x402/access — no separate route registrations needed.
 *
 * For per-request plans, clients post to /x402/access with:
 *   { planId, resource: { method, path } }
 * Key0 issues the 402, settles the payment, then proxies the request to the
 * backend (injecting X-Gateway-Secret + payment headers) and returns the
 * ResourceResponse directly — no token issuance, no client-side Bearer header.
 *
 * For subscription plans, the legacy /x402/access → AccessGrant (JWT) flow is used.
 *
 * A2A agents: POST /x402/access via A2A JSON-RPC with resource field.
 * MCP clients: use the request_access tool with resource field.
 * HTTP clients: POST /x402/access directly.
 *
 * Start order:
 *   1. bun run start:backend   (port 3001)
 *   2. bun run start:gateway   (port 3000)
 */

import type { NetworkName } from "@key0ai/key0";
import {
	AccessTokenIssuer,
	RedisChallengeStore,
	RedisSeenTxStore,
	X402Adapter,
} from "@key0ai/key0";
import { key0Router } from "@key0ai/key0/express";
import express from "express";
import Redis from "ioredis";

const GATEWAY_PORT = Number(process.env["GATEWAY_PORT"] ?? 3000);
const PUBLIC_URL = process.env["PUBLIC_URL"] ?? `http://localhost:${GATEWAY_PORT}`;
const BACKEND_URL = process.env["BACKEND_URL"] ?? "http://localhost:3001";
const NETWORK = (process.env["KEY0_NETWORK"] ?? "testnet") as NetworkName;
const WALLET = (process.env["KEY0_WALLET_ADDRESS"] ??
	"0x0000000000000000000000000000000000000000") as `0x${string}`;
const SECRET =
	process.env["KEY0_ACCESS_TOKEN_SECRET"] ?? "dev-secret-change-me-in-production-32chars!";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
// Shared secret sent to the backend so it can reject requests that bypass the gateway.
const GATEWAY_SECRET = process.env["GATEWAY_SECRET"] ?? "dev-gateway-secret-change-in-production";
// Gas wallet private key for self-contained on-chain settlement (no Coinbase facilitator needed).
const GAS_WALLET_KEY = process.env["GAS_WALLET_PRIVATE_KEY"] as `0x${string}` | undefined;

const app = express();
app.use(express.json());

const adapter = new X402Adapter({
	network: NETWORK,
	rpcUrl: process.env["KEY0_RPC_URL"],
});

const redis = new Redis(REDIS_URL);
const store = new RedisChallengeStore({ redis });
const seenTxStore = new RedisSeenTxStore({ redis });

// Required by SellerConfig for subscription plans.
// Per-request plans skip this — they proxy to the backend inline and return ResourceResponse.
const tokenIssuer = new AccessTokenIssuer(SECRET);

const key0 = key0Router({
	config: {
		agentName: "Pay-Per-Request Demo (Standalone Gateway)",
		agentDescription:
			"Micro-payment gateway in standalone mode. After payment the request is forwarded to the backend service — clients receive the backend response directly.",
		agentUrl: PUBLIC_URL,
		providerName: "Example Corp",
		providerUrl: "https://example.com",
		walletAddress: WALLET,
		network: NETWORK,
		challengeTTLSeconds: 300,
		...(GAS_WALLET_KEY ? { gasWalletPrivateKey: GAS_WALLET_KEY } : {}),
		plans: [
			{
				planId: "weather-query",
				unitAmount: "$0.01",
				description: "Current weather for any city — $0.01 per request.",
				mode: "per-request",
				routes: [
					{
						method: "GET",
						path: "/api/weather/:city",
						description: "Current weather conditions for a given city",
					},
				],
			},
			{
				planId: "joke-of-the-day",
				unitAmount: "$0.005",
				description: "A random programming joke — $0.005 per request.",
				mode: "per-request",
				routes: [
					{
						method: "GET",
						path: "/api/joke",
						description: "Get a random programming joke",
					},
				],
			},
		],
		fetchResourceCredentials: async (params) => {
			return tokenIssuer.sign(
				{
					sub: params.requestId,
					jti: params.challengeId,
					resourceId: params.resourceId,
					planId: params.planId,
					txHash: params.txHash,
				},
				3600,
			);
		},
		// proxyTo enables standalone mode: all per-request plans are routed through /x402/access.
		// X-Gateway-Secret is injected so the backend can reject requests that bypass the gateway.
		// Payment metadata headers (txHash, planId, amount, payer) are injected automatically by
		// the built-in proxyToFetchResource helper.
		proxyTo: {
			baseUrl: BACKEND_URL,
			headers: {
				"x-gateway-secret": GATEWAY_SECRET,
			},
		},
	},
	adapter,
	store,
	seenTxStore,
});

// Mount Key0 — serves agent card, /discovery, and /x402/access.
// No separate route registrations needed: per-request plans flow through /x402/access.
app.use(key0);

app.listen(GATEWAY_PORT, () => {
	console.log(`\nPay-Per-Request Gateway (standalone) running on ${PUBLIC_URL}`);
	console.log(`  Agent card:    ${PUBLIC_URL}/.well-known/agent.json`);
	console.log(`  Discovery:     GET ${PUBLIC_URL}/discovery`);
	console.log(`  x402 endpoint: POST ${PUBLIC_URL}/x402/access`);
	console.log(`  A2A endpoint:  POST ${PUBLIC_URL}/x402/access  (via A2A JSON-RPC)`);
	console.log(`  MCP endpoint:  POST ${PUBLIC_URL}/mcp  (request_access tool with resource field)`);
	console.log(`\n  Per-request flow (HTTP):`);
	console.log(`    POST ${PUBLIC_URL}/x402/access`);
	console.log(
		`         { planId: "weather-query", resource: { method: "GET", path: "/api/weather/london" } }`,
	);
	console.log(`    → 402 Payment Required`);
	console.log(`    → Pay USDC on-chain`);
	console.log(`    → Retry with PAYMENT-SIGNATURE header`);
	console.log(`    → 200 ResourceResponse (backend data, no token)`);
	console.log(`\n  Backend: ${BACKEND_URL}`);
	console.log(`  Network: ${NETWORK}`);
	console.log(`  Wallet:  ${WALLET}\n`);
});

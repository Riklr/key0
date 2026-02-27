import { Hono } from "hono";
import { agentGateApp, honoValidateAccessToken } from "@agentgate/sdk/hono";
import { X402Adapter } from "@agentgate/x402-adapter";
import type { NetworkName } from "@agentgate/types";

const PORT = Number(process.env["PORT"] ?? 3001);
const NETWORK = (process.env["AGENTGATE_NETWORK"] ?? "testnet") as NetworkName;
const WALLET = (process.env["AGENTGATE_WALLET_ADDRESS"] ??
	"0x0000000000000000000000000000000000000000") as `0x${string}`;
const SECRET =
	process.env["AGENTGATE_ACCESS_TOKEN_SECRET"] ??
	"dev-secret-change-me-in-production-32chars!";

// Create the x402 payment adapter
const adapter = new X402Adapter({
	network: NETWORK,
	rpcUrl: process.env["AGENTGATE_RPC_URL"],
});

// Mount AgentGate — serves agent card + A2A endpoint
const gate = agentGateApp({
	config: {
		agentName: "Photo Gallery Agent",
		agentDescription:
			"Purchase access to premium photos via USDC payments on Base",
		agentUrl: `http://localhost:${PORT}`,
		providerName: "Example Corp",
		providerUrl: "https://example.com",
		walletAddress: WALLET,
		network: NETWORK,
		accessTokenSecret: SECRET,
		accessTokenTTLSeconds: 3600,
		challengeTTLSeconds: 900,
		products: [
			{
				tierId: "single-photo",
				label: "Single Photo",
				amount: "$0.10",
				resourceType: "photo",
				accessDurationSeconds: 3600,
			},
			{
				tierId: "full-album",
				label: "Full Album Access",
				amount: "$1.00",
				resourceType: "album",
				accessDurationSeconds: 86400,
			},
		],
		onVerifyResource: async (resourceId: string, _tierId: string) => {
			const validResources = ["photo-1", "photo-2", "photo-3", "album-1"];
			return validResources.includes(resourceId);
		},
		onPaymentReceived: async (grant) => {
			console.log(
				`[Payment] Received payment for ${grant.resourceId} (${grant.tierId})`,
			);
			console.log(`  TX: ${grant.explorerUrl}`);
		},
		resourceEndpointTemplate: `http://localhost:${PORT}/api/photos/{resourceId}`,
	},
	adapter,
});

const app = new Hono();

// Mount AgentGate routes
app.route("/", gate);

// Protect API routes with access token validation
const api = new Hono();
api.use("/*", honoValidateAccessToken({ secret: SECRET }));

api.get("/photos/:id", (c) => {
	const photoId = c.req.param("id");
	return c.json({
		id: photoId,
		url: `https://cdn.example.com/photos/${photoId}.jpg`,
		title: `Premium Photo ${photoId}`,
		resolution: "4K",
	});
});

app.route("/api", api);

export default {
	port: PORT,
	fetch: app.fetch,
};

console.log(`\nPhoto Gallery Agent (Hono) running on http://localhost:${PORT}`);
console.log(`  Agent card: http://localhost:${PORT}/.well-known/agent.json`);
console.log(`  A2A endpoint: http://localhost:${PORT}/agent`);
console.log(`  Network: ${NETWORK}`);
console.log(`  Wallet: ${WALLET}\n`);

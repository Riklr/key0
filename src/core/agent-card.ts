import type { AgentCard, AgentExtension, AgentSkill, SellerConfig } from "../types/index.js";
import { CHAIN_CONFIGS, CHAIN_ID_TO_NETWORK, X402_EXTENSION_URI } from "../types/index.js";

export function buildAgentCard(config: SellerConfig): AgentCard {
	const networkConfig = CHAIN_CONFIGS[config.network];
	const networkName =
		CHAIN_ID_TO_NETWORK[networkConfig.chainId] ?? `chain-${networkConfig.chainId}`;

	const baseUrl = config.agentUrl.replace(/\/$/, "");

	const planIds = (config.plans ?? []).map((p) => p.planId);

	// Core A2A skills (discovery + subscription purchase)
	// Additional per-request skills are appended below for each gated route.
	const skills: AgentSkill[] = [
		{
			id: "discover",
			name: "Discover",
			description: [
				`Browse available plans and pricing for ${config.agentName}.`,
				`Returns the product catalog with plan IDs, prices (USDC on ${networkName}), wallet address, and chain ID.`,
				`GET to ${baseUrl}/discover to discover plans.`,
			].join(" "),
			tags: ["discovery", "catalog", "x402"],
			examples: [`GET ${baseUrl}/discover`],
			endpoint: { url: `${baseUrl}/discover`, method: "GET" },
		},
		{
			id: "access",
			name: "Access",
			description: [
				`Purchase access to a ${config.agentName} product plan via x402 payment on ${networkName}.`,
				`First call discover to get available plans.`,
				`Then POST to ${baseUrl}/x402/access with planId and requestId to initiate purchase.`,
				`Server responds with x402 payment challenge.`,
				`Complete payment on-chain and include PAYMENT-SIGNATURE header to receive access token.`,
			].join(" "),
			tags: ["payment", "x402", "purchase"],
			examples: [
				`POST ${baseUrl}/x402/access with { planId: "<plan-id>", requestId: "<uuid>", resourceId: "default" }`,
				`Receive 402 with payment challenge`,
				`Pay USDC on-chain, retry same request with PAYMENT-SIGNATURE header`,
				`Receive 200 with access token`,
			],
			endpoint: { url: `${baseUrl}/x402/access`, method: "POST" },
			inputSchema: {
				type: "object",
				required: ["planId", "requestId"],
				properties: {
					planId: { type: "string", enum: planIds },
					requestId: { type: "string", format: "uuid" },
				},
			},
			workflow: [
				"POST body with planId + requestId to endpoint.url — expect 402",
				"Extract payment requirements from 402 response body",
				`Sign and broadcast USDC transfer on ${networkName}`,
				"Retry same POST with PAYMENT-SIGNATURE header containing the transaction hash",
				"Receive 200 with accessToken",
			],
		},
	];

	// Per-request skills: one skill per route in config.routes.
	for (const route of config.routes ?? []) {
		const skillId = `ppr-${route.routeId}-${route.method.toLowerCase()}-${route.path.replace(/\//g, "-").replace(/[: ]/g, "")}`;
		skills.push({
			id: skillId,
			name: `${route.method} ${route.path}`,
			description: route.description ?? (route.unitAmount
				? `Pay-per-request: ${route.unitAmount} USDC per call.`
				: `Free endpoint: ${route.method} ${route.path}`),
			tags: route.unitAmount ? ["pay-per-request", "x402"] : ["free"],
			endpoint: { url: `${baseUrl}/x402/access`, method: "POST" },
			inputSchema: {
				type: "object",
				required: ["routeId", "resource"],
				properties: {
					routeId: { type: "string", const: route.routeId },
					resource: {
						type: "object",
						required: ["method", "path"],
						properties: {
							method: { type: "string", const: route.method },
							path: { type: "string", description: `Path pattern: ${route.path}` },
						},
					},
				},
			},
			workflow: route.unitAmount
				? [
						`POST { routeId: "${route.routeId}", resource: { method: "${route.method}", path: "<actual path>" } }`,
						"Receive 402 with payment requirements",
						`Pay ${route.unitAmount} USDC on-chain`,
						"Retry with PAYMENT-SIGNATURE header",
						"Receive 200 with ResourceResponse",
					]
				: [
						`POST { routeId: "${route.routeId}", resource: { method: "${route.method}", path: "<actual path>" } }`,
						"Free route — no payment required",
						"Receive 200 with ResourceResponse",
					],
		});
	}

	const x402Extension: AgentExtension = {
		uri: X402_EXTENSION_URI,
		description: `Supports x402 payments with USDC on ${networkName}.`,
		required: true,
	};

	return {
		name: config.agentName,
		description: config.agentDescription,
		url: `${baseUrl}/x402/access`,
		version: config.version ?? "1.0.0",
		protocolVersion: "0.3.0",
		capabilities: {
			extensions: [x402Extension],
			pushNotifications: false,
			streaming: false,
			stateTransitionHistory: false,
		},
		defaultInputModes: ["text"],
		defaultOutputModes: ["application/json"],
		skills,
		provider: {
			organization: config.providerName,
			url: config.providerUrl,
		},
	};
}

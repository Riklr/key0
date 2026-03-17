import type { AgentCard, AgentExtension, AgentSkill, SellerConfig } from "../types/index.js";
import { CHAIN_CONFIGS, CHAIN_ID_TO_NETWORK, X402_EXTENSION_URI } from "../types/index.js";

export function buildAgentCard(config: SellerConfig): AgentCard {
	const networkConfig = CHAIN_CONFIGS[config.network];
	const networkName =
		CHAIN_ID_TO_NETWORK[networkConfig.chainId] ?? `chain-${networkConfig.chainId}`;

	const baseUrl = config.agentUrl.replace(/\/$/, "");

	const planIds = config.plans.map((p) => p.planId);

	// Standalone mode: fetchResource or proxyTo is set on SellerConfig.
	// Per-request skills point to /x402/access (supports HTTP, A2A, MCP).
	// Embedded mode: per-request skills point to the actual route URLs (HTTP-only).
	const isStandalone = !!(config.fetchResource ?? config.proxyTo);

	// Core A2A skills (discovery + subscription purchase)
	// Additional per-request skills are appended below for each gated route.
	const skills: AgentSkill[] = [
		{
			id: "discover-plans",
			name: "Discover Plans",
			description: [
				`Browse available plans and pricing for ${config.agentName}.`,
				`Returns the product catalog with plan IDs, prices (USDC on ${networkName}), wallet address, and chain ID.`,
				`GET to ${baseUrl}/discovery to discover plans.`,
			].join(" "),
			tags: ["discovery", "catalog", "x402"],
			examples: [`GET ${baseUrl}/discovery`],
			endpoint: { url: `${baseUrl}/discovery`, method: "GET" },
		},
		{
			id: "request-access",
			name: "Request Access",
			description: [
				`Purchase access to a ${config.agentName} product plan via x402 payment on ${networkName}.`,
				`First call discover-plans to get available plans.`,
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

	// Per-request skills: one skill per gated route across all per-request plans.
	// Standalone: skills point to /x402/access with workflow + inputSchema (A2A/MCP/HTTP).
	// Embedded: skills point to the actual route URL (HTTP-only, direct middleware gating).
	for (const plan of config.plans) {
		if (plan.mode !== "per-request" || !plan.routes?.length) continue;
		for (const route of plan.routes) {
			const method = route.method.toUpperCase() as "GET" | "POST";
			const skillId = `ppr-${plan.planId}-${route.method.toLowerCase()}-${route.path.replace(/\//g, "-").replace(/:/g, "")}`;
			const description =
				route.description ??
				`Pay-per-request: ${plan.unitAmount} USDC per call. Plan: ${plan.planId}.`;

			if (isStandalone) {
				skills.push({
					id: skillId,
					name: `${route.method} ${route.path}`,
					description,
					tags: ["pay-per-request", "x402", plan.planId],
					endpoint: { url: `${baseUrl}/x402/access`, method: "POST" },
					inputSchema: {
						type: "object",
						required: ["planId", "resource"],
						properties: {
							planId: { type: "string", const: plan.planId },
							resource: {
								type: "object",
								required: ["method", "path"],
								properties: {
									method: {
										type: "string",
										const: route.method,
										description: `HTTP method for this route (${route.method})`,
									},
									path: {
										type: "string",
										description: `Path pattern: ${route.path}`,
									},
								},
							},
						},
					},
					workflow: [
						`POST to ${baseUrl}/x402/access with { planId: "${plan.planId}", resource: { method: "${route.method}", path: "<actual path>" } }`,
						"Receive 402 with payment requirements",
						`Pay ${plan.unitAmount} USDC on-chain`,
						"Retry same POST with PAYMENT-SIGNATURE header",
						"Receive 200 with ResourceResponse containing the backend data (not a token)",
					],
				});
			} else {
				skills.push({
					id: skillId,
					name: `${route.method} ${route.path}`,
					description,
					tags: ["pay-per-request", "x402", plan.planId],
					endpoint: { url: `${baseUrl}${route.path}`, method },
				});
			}
		}
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

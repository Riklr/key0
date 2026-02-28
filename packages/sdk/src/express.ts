import { Router } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { type AgentGateConfig, createAgentGate } from "./factory.js";
import type { ValidateAccessTokenConfig } from "./middleware.js";

/**
 * Create an Express router that serves the agent card and A2A endpoint.
 *
 * Usage:
 *   app.use(agentGateRouter({ config, adapter }));
 *
 * This auto-serves:
 *   GET  /.well-known/agent.json
 *   POST {config.basePath} (A2A tasks/send)
 */
export function agentGateRouter(opts: AgentGateConfig): Router {
	const { requestHandler } = createAgentGate(opts);
	const router = Router();

	// Agent Card
	router.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));

	// A2A endpoint
	const basePath = opts.config.basePath ?? "/agent";
	router.use(basePath, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

	return router;
}

export { validateAccessToken } from "./middleware.js";
export type { ValidateAccessTokenConfig };

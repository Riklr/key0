import {
	AccessTokenIssuer,
	ChallengeEngine,
	InMemoryChallengeStore,
	InMemorySeenTxStore,
} from "@agentgate/core";
import type {
	IChallengeStore,
	IPaymentAdapter,
	ISeenTxStore,
	SellerConfig,
} from "@agentgate/types";
import { AgentGateError } from "@agentgate/types";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type ValidateAccessTokenConfig, validateToken } from "./middleware.js";
import { AgentGateRouter } from "./router.js";

export type AgentGateFastifyConfig = {
	readonly config: SellerConfig;
	readonly adapter: IPaymentAdapter;
	readonly store?: IChallengeStore | undefined;
	readonly seenTxStore?: ISeenTxStore | undefined;
};

/**
 * Fastify plugin that serves the agent card and A2A endpoint.
 *
 * Usage:
 *   fastify.register(agentGatePlugin, { config, adapter });
 */
export async function agentGatePlugin(
	fastify: FastifyInstance,
	opts: AgentGateFastifyConfig,
): Promise<void> {
	const store = opts.store ?? new InMemoryChallengeStore();
	const seenTxStore = opts.seenTxStore ?? new InMemorySeenTxStore();
	const tokenIssuer = new AccessTokenIssuer(opts.config.accessTokenSecret);

	const engine = new ChallengeEngine({
		config: opts.config,
		store,
		seenTxStore,
		adapter: opts.adapter,
		tokenIssuer,
	});

	const handler = new AgentGateRouter({ engine, config: opts.config });

	// Agent Card
	fastify.get("/.well-known/agent.json", async (_request: FastifyRequest, reply: FastifyReply) => {
		const result = await handler.handleAgentCard();
		if (result.headers) {
			for (const [k, v] of Object.entries(result.headers)) {
				reply.header(k, v);
			}
		}
		return reply.status(result.status).send(result.body);
	});

	// A2A endpoint
	const basePath = opts.config.basePath ?? "/agent";
	fastify.post(basePath, async (request: FastifyRequest, reply: FastifyReply) => {
		const result = await handler.handleA2ATask(request.body as never);
		return reply.status(result.status).send(result.body);
	});
}

/**
 * Fastify onRequest hook to validate access tokens.
 *
 * Usage:
 *   fastify.addHook("onRequest", fastifyValidateAccessToken({ secret: ... }));
 *
 * Or per-route:
 *   fastify.get("/api/photos/:id", { onRequest: fastifyValidateAccessToken({ secret }) }, handler);
 */
export function fastifyValidateAccessToken(config: ValidateAccessTokenConfig) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			const payload = await validateToken(request.headers.authorization, config);
			(request as FastifyRequest & { agentGateToken?: unknown }).agentGateToken = payload;
		} catch (err: unknown) {
			if (err instanceof AgentGateError) {
				return reply.status(err.httpStatus).send(err.toJSON());
			}
			return reply
				.status(500)
				.send({ type: "Error", code: "INTERNAL_ERROR", message: "Internal error" });
		}
	};
}

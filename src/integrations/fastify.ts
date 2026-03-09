import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type Key2aConfig, createKey2a } from "../factory.js";
import type { ValidateAccessTokenConfig } from "../middleware.js";
import { validateToken } from "../middleware.js";
import { Key2aError } from "../types/index.js";

/**
 * Fastify plugin that serves the agent card and A2A endpoint.
 *
 * Usage:
 *   fastify.register(key2aPlugin, { config, adapter });
 */
export async function key2aPlugin(
	fastify: FastifyInstance,
	opts: Key2aConfig,
): Promise<void> {
	const { requestHandler, agentCard } = createKey2a(opts);

	// Agent Card
	fastify.get(`/${AGENT_CARD_PATH}`, async (_request: FastifyRequest, reply: FastifyReply) => {
		return reply.send(agentCard);
	});

	// A2A endpoint
	const basePath = opts.config.basePath ?? "/agent";
	fastify.post(basePath, async (_request: FastifyRequest, reply: FastifyReply) => {
		// TODO: Use official A2A Fastify handler when available
		return reply.code(501).send({ error: "Fastify support pending A2A SDK update" });
	});
}

/**
 * Fastify onRequest hook to validate access tokens.
 */
export function fastifyValidateAccessToken(config: ValidateAccessTokenConfig) {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			const payload = await validateToken(request.headers.authorization, config);
			(request as FastifyRequest & { key2aToken?: unknown }).key2aToken = payload;
		} catch (err: unknown) {
			if (err instanceof Key2aError) {
				return reply.status(err.httpStatus).send(err.toJSON());
			}
			return reply
				.status(500)
				.send({ type: "Error", code: "INTERNAL_ERROR", message: "Internal error" });
		}
	};
}

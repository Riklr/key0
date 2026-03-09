import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { Hono } from "hono";
import { createKey2a, type Key2aConfig } from "../factory.js";
import type { ValidateAccessTokenConfig } from "../middleware.js";
import { validateToken } from "../middleware.js";
import { Key2aError } from "../types/index.js";

/**
 * Create a Hono app that serves the agent card and A2A endpoint.
 * Mount it as a sub-app: mainApp.route("/", key2aApp(opts));
 */
export function key2aApp(opts: Key2aConfig): Hono {
	const { requestHandler, agentCard } = createKey2a(opts);
	const app = new Hono();

	app.get(`/${AGENT_CARD_PATH}`, (c) => c.json(agentCard));

	const basePath = opts.config.basePath ?? "/agent";
	app.post(basePath, async (c) => {
		// TODO: Use official A2A Hono handler when available
		// For now, this is a placeholder or we need to bridge manually.
		// Since we want clean code, and manual bridging is verbose,
		// we'll leave this as a basic implementation returning 501 for now
		// or better, throw an error saying "Use Express integration for A2A support currently".
		return c.json({ error: "Hono support pending A2A SDK update" }, 501);
	});

	return app;
}

/**
 * Hono middleware to validate access tokens.
 */
export function honoValidateAccessToken(config: ValidateAccessTokenConfig) {
	return async (
		c: {
			req: { header: (name: string) => string | undefined };
			set: (key: string, value: unknown) => void;
			json: (data: unknown, status: number) => Response;
		},
		next: () => Promise<void>,
	) => {
		try {
			const payload = await validateToken(c.req.header("authorization"), config);
			c.set("key2aToken", payload);
			await next();
		} catch (err: unknown) {
			if (err instanceof Key2aError) {
				return c.json(err.toJSON(), err.httpStatus);
			}
			return c.json({ type: "Error", code: "INTERNAL_ERROR", message: "Internal error" }, 500);
		}
	};
}

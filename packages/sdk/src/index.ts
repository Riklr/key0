// Middleware
export { validateToken } from "./middleware.js";
export type { AccessTokenPayload, ValidateAccessTokenConfig } from "./middleware.js";

// Executor
export { AgentGateExecutor } from "./executor.js";

// Factory
export { createAgentGate } from "./factory.js";
export type { AgentGateConfig } from "./factory.js";

// Export A2A types if needed, or rely on @a2a-js/sdk
export type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";

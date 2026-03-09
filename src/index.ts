// Export Types

// Export A2A types if needed, or rely on @a2a-js/sdk
export type { AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";

// Export Adapter Logic
export * from "./adapter/index.js";

// Export Core Logic
export * from "./core/index.js";
// Executor
export { Key2aExecutor } from "./executor.js";
export type { Key2aConfig } from "./factory.js";
// Factory
export { createKey2a } from "./factory.js";
export type { AuthHeaderProvider } from "./helpers/auth.js";
// Auth Strategies
export { oauthClientCredentialsAuth, sharedSecretAuth, signedJwtAuth } from "./helpers/auth.js";
export type { RemoteTokenIssuerConfig, RemoteVerifierConfig } from "./helpers/remote.js";
// Remote Helpers (for separate service deployments)
export { createRemoteResourceVerifier, createRemoteTokenIssuer } from "./helpers/remote.js";
export type { AccessTokenPayload, ValidateAccessTokenConfig } from "./middleware.js";
// Middleware
export { validateToken } from "./middleware.js";
export * from "./types/index.js";
export type {
	AccessTokenPayload as ValidatorAccessTokenPayload,
	ValidatorConfig,
} from "./validator/index.js";
// Validator (lightweight for backend services)
export { validateKey2aToken } from "./validator/index.js";

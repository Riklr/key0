/**
 * Backend Service Example
 *
 * This example shows how to integrate with Key2a standalone service.
 * It demonstrates both token validation modes:
 * - Native: Validates Key2a JWT tokens
 * - Remote: Issues custom tokens when Key2a calls /internal/issue-token
 *
 * Usage:
 *   bun run start
 */

import type { AccessTokenPayload } from "@riklr/key2a";
import { validateKey2aToken } from "@riklr/key2a";
import express from "express";

const PORT = Number(process.env.PORT ?? 3000);
const KEY2A_SECRET = process.env.KEY2A_ACCESS_TOKEN_SECRET!;
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET!;

const app = express();
app.use(express.json());

// Mock database — maps resourceId to which plans can access it
const resources = new Map<string, { allowedPlans: string[] }>([
	["default", { allowedPlans: ["basic", "starter-monthly", "starter-yearly", "pro-monthly"] }],
	["photo-1", { allowedPlans: ["basic", "starter-monthly", "starter-yearly", "pro-monthly"] }],
	["photo-2", { allowedPlans: ["basic", "starter-monthly", "starter-yearly", "pro-monthly"] }],
	["album-1", { allowedPlans: ["starter-monthly", "starter-yearly", "pro-monthly"] }],
	["bulk-export", { allowedPlans: ["pro-monthly"] }],
]);

const apiKeys = new Map<
	string,
	{ expiresAt: Date; resourceId: string; planId: string; quota?: number; maxConcurrent?: number }
>();

// ============================================================================
// Internal Endpoints (called by Key2a Service)
// ============================================================================

// Middleware to verify internal auth
function verifyInternalAuth(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	const authHeader = req.headers["x-internal-auth"];
	if (authHeader !== INTERNAL_AUTH_SECRET) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	next();
}

// Verify resource exists
app.post("/internal/verify-resource", verifyInternalAuth, (req, res) => {
	const { resourceId, planId } = req.body;

	const resource = resources.get(resourceId);
	const valid = resource?.allowedPlans.includes(planId);
	res.json({ valid });
});

// Plan entitlements — the seller defines what each plan grants.
// In production this would come from your database or config.
const planEntitlements: Record<string, { ttlMs: number; quota?: number; maxConcurrent?: number }> =
	{
		basic: { ttlMs: 3600 * 1000 }, // 1 hour, per-use
		"starter-monthly": { ttlMs: 30 * 86400 * 1000, quota: 1650, maxConcurrent: 10 },
		"starter-yearly": { ttlMs: 365 * 86400 * 1000, quota: 1650, maxConcurrent: 10 },
		"pro-monthly": { ttlMs: 30 * 86400 * 1000, quota: 16500, maxConcurrent: 50 },
	};

// Issue token (only used if Key2a tokenMode="remote")
app.post("/internal/issue-token", (req, res) => {
	const { resourceId, planId } = req.body;

	const entitlements = planEntitlements[planId] ?? { ttlMs: 3600 * 1000 };

	// Generate a custom API key (in production, use your actual key generation)
	const apiKey = `ak_${crypto.randomUUID().replace(/-/g, "")}`;
	const expiresAt = new Date(Date.now() + entitlements.ttlMs);

	// Store the key with entitlements — your API middleware reads these to enforce limits
	apiKeys.set(apiKey, { expiresAt, resourceId, planId, ...entitlements });

	console.log(`[Backend] Issued API key for resource ${resourceId}, plan ${planId}`);

	res.json({
		token: apiKey,
		expiresAt: expiresAt.toISOString(),
		tokenType: "Bearer",
	});
});

// Payment received notification
app.post("/internal/payment-received", verifyInternalAuth, (req, res) => {
	const grant = req.body;
	console.log(`[Backend] Payment received: ${grant.resourceId} (${grant.planId})`);
	console.log(`  TX: ${grant.explorerUrl}`);

	// Your payment handling logic here
	// e.g., update database, send webhook, etc.

	res.json({ received: true });
});

// ============================================================================
// Protected API Endpoints
// ============================================================================

// Middleware to validate Key2a tokens (Native Mode)
async function validateToken(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	try {
		const payload = await validateKey2aToken(req.headers.authorization, {
			secret: KEY2A_SECRET,
		});

		// Attach token to request
		(req as express.Request & { key2aToken: AccessTokenPayload }).key2aToken = payload;
		next();
	} catch (err) {
		// If native token validation fails, check for custom API key (Remote Mode)
		const authHeader = req.headers.authorization;
		if (authHeader?.startsWith("Bearer ")) {
			const apiKey = authHeader.slice(7);
			const keyData = apiKeys.get(apiKey);
			if (keyData && keyData.expiresAt > new Date()) {
				// Valid API key
				(
					req as express.Request & {
						key2aToken: { resourceId: string; planId: string; type: string };
					}
				).key2aToken = {
					resourceId: keyData.resourceId,
					planId: keyData.planId,
					type: "api-key",
				};
				return next();
			}
		}

		res.status(401).json({
			error: "Unauthorized",
			message: err instanceof Error ? err.message : "Invalid token",
		});
	}
}

// Protect API routes
app.use("/api", validateToken);

// Sample protected endpoint
app.get("/api/photos/:id", (req, res) => {
	const token = (req as unknown as { key2aToken: AccessTokenPayload }).key2aToken;

	// Subscription tokens (resourceId "default") grant access to any resource
	// Per-use tokens are scoped to a specific resourceId
	if (token.resourceId !== "default" && req.params.id !== token.resourceId) {
		return res.status(403).json({ error: "Token not valid for this resource" });
	}

	const resource = resources.get(req.params.id);
	if (!resource) {
		return res.status(404).json({ error: "Resource not found" });
	}

	// Verify plan access
	if (!resource.allowedPlans.includes(token.planId)) {
		return res.status(403).json({ error: "Your plan does not grant access to this resource" });
	}

	res.json({
		id: req.params.id,
		planId: token.planId,
		url: `https://cdn.example.com/photos/${req.params.id}.jpg`,
		title: `Photo ${req.params.id}`,
		resolution: "4K",
	});
});

app.get("/api/data/:id", (req, res) => {
	const token = (req as unknown as { key2aToken: AccessTokenPayload }).key2aToken;

	// Token with "default" resourceId grants tier-based access to all endpoints
	res.json({
		id: req.params.id,
		data: "premium content",
		planId: token.planId,
		resourceId: token.resourceId,
	});
});

// Health check
app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "backend" });
});

app.listen(PORT, () => {
	console.log("\n📦 Backend Service");
	console.log(`   Port: ${PORT}`);
	console.log("   Protected APIs: /api/*");
	console.log("   Internal endpoints: /internal/*\n");
});

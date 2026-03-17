/**
 * Backend API service — no Key0 imports.
 *
 * This is the real API implementation. It is NOT exposed directly to clients;
 * the gateway (gateway.ts) sits in front and requires payment before proxying
 * requests here. The backend validates the X-Gateway-Secret header on every
 * request and returns 403 if it is absent or incorrect.
 *
 * In production, restrict access to the gateway's IP only.
 *
 * Start this BEFORE the gateway:
 *   bun run start:backend
 */

import express, { type NextFunction, type Request, type Response } from "express";

const PORT = Number(process.env["BACKEND_PORT"] ?? 3001);
// Must match GATEWAY_SECRET in gateway.ts / environment
const GATEWAY_SECRET = process.env["GATEWAY_SECRET"] ?? "dev-gateway-secret-change-in-production";

const app = express();
app.use(express.json());

// ── Gateway auth guard ───────────────────────────────────────────────────────
// Reject any request that did not come through the paid gateway.
function requireGatewayAuth(req: Request, res: Response, next: NextFunction): void {
	const secret = req.headers["x-gateway-secret"];
	if (!secret || secret !== GATEWAY_SECRET) {
		res.status(403).json({
			error: "Forbidden",
			message: "Direct backend access is not allowed. Route requests through the Key0 gateway.",
		});
		return;
	}
	next();
}

app.use(requireGatewayAuth);

// ── GET /api/weather/:city ───────────────────────────────────────────────────
app.get("/api/weather/:city", (req, res) => {
	const city = req.params["city"] ?? "unknown";

	// Payment metadata forwarded by the gateway
	const txHash = req.headers["x-key0-tx-hash"];
	const planId = req.headers["x-key0-plan-id"];
	const amount = req.headers["x-key0-amount"];
	const payer = req.headers["x-key0-payer"];

	const conditions = ["Sunny", "Cloudy", "Rainy", "Windy", "Partly Cloudy"];
	res.json({
		city,
		tempF: Math.round(55 + Math.random() * 35),
		condition: conditions[Math.floor(Math.random() * conditions.length)],
		humidity: `${Math.round(40 + Math.random() * 40)}%`,
		source: "backend",
		payment: { txHash, planId, amount, payer },
	});
});

// ── GET /api/joke ────────────────────────────────────────────────────────────
app.get("/api/joke", (req, res) => {
	const txHash = req.headers["x-key0-tx-hash"];
	const planId = req.headers["x-key0-plan-id"];
	const amount = req.headers["x-key0-amount"];
	const payer = req.headers["x-key0-payer"];

	const jokes = [
		"Why do programmers prefer dark mode? Because light attracts bugs.",
		"A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
		"Why did the developer go broke? Because he used up all his cache.",
		"There are only 10 types of people in the world: those who understand binary, and those who don't.",
		"Why do Java developers wear glasses? Because they don't C#.",
	];

	res.json({
		joke: jokes[Math.floor(Math.random() * jokes.length)],
		source: "backend",
		payment: { txHash, planId, amount, payer },
	});
});

app.listen(PORT, () => {
	console.log(`\nBackend API running on http://localhost:${PORT}`);
	console.log(`  Weather: GET http://localhost:${PORT}/api/weather/:city`);
	console.log(`  Joke:    GET http://localhost:${PORT}/api/joke\n`);
	console.log("  NOTE: This service is NOT payment-gated — start the gateway to add payment.");
	console.log("        In production, restrict access to the gateway's IP only.\n");
});

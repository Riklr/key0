/**
 * x402 Discovery — verifies the discovery flow via POST /x402/access with no planId.
 *
 * When a client POSTs to /x402/access without a planId, Key2a returns HTTP 402
 * with all available plans in the accepts array. No PENDING record is created.
 * This is the entry point for clients that don't yet know which plan to purchase.
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_TIER_ID, KEY2A_URL } from "../fixtures/constants.ts";

describe("x402 Discovery", () => {
	test("POST /x402/access with no body returns 402 with all plans", async () => {
		const res = await fetch(`${KEY2A_URL}/x402/access`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(402);

		const body = (await res.json()) as Record<string, unknown>;
		const accepts = body["accepts"] as Array<Record<string, unknown>>;

		expect(Array.isArray(accepts)).toBe(true);
		expect(accepts.length).toBeGreaterThan(0);

		// Each plan in accepts must have required x402 fields
		const plan = accepts[0]!;
		expect(plan["scheme"]).toBe("exact");
		expect(plan["network"]).toBe("eip155:84532");
		expect(typeof plan["asset"]).toBe("string");
		expect(typeof plan["amount"]).toBe("string");
		expect(BigInt(plan["amount"] as string)).toBeGreaterThan(0n);
		expect(typeof plan["payTo"]).toBe("string");

		// Discovery plans include planId in extra
		const extra = plan["extra"] as Record<string, unknown> | undefined;
		expect(typeof extra?.["planId"]).toBe("string");
		expect(extra?.["planId"]).toBe(DEFAULT_TIER_ID);

		// No challengeId — pure discovery, no PENDING record created
		expect(body["challengeId"]).toBeUndefined();

		// payment-required header is set
		const header = res.headers.get("payment-required");
		expect(header).toBeTruthy();
		const decoded = JSON.parse(Buffer.from(header!, "base64").toString("utf-8"));
		expect(decoded.x402Version).toBe(2);
	});

	test("discovery response includes key2a extensions with input/output schema", async () => {
		const res = await fetch(`${KEY2A_URL}/x402/access`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(402);
		const body = (await res.json()) as Record<string, unknown>;

		const extensions = body["extensions"] as Record<string, unknown> | undefined;
		expect(extensions).toBeDefined();

		const key2a = extensions?.["key2a"] as Record<string, unknown> | undefined;
		expect(key2a).toBeDefined();
		expect(key2a?.["inputSchema"]).toBeDefined();
		expect(key2a?.["outputSchema"]).toBeDefined();
	});

	test("www-authenticate header is set on discovery response", async () => {
		const res = await fetch(`${KEY2A_URL}/x402/access`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(402);
		const wwwAuth = res.headers.get("www-authenticate");
		expect(wwwAuth).toBeTruthy();
		expect(wwwAuth).toContain("Payment");
	});
});

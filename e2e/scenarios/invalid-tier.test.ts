/**
 * Invalid Plan — verifies that requesting a nonexistent planId returns an error.
 *
 * The /x402/access endpoint validates the plan before creating a challenge.
 * No on-chain tx needed.
 */

import { describe, expect, test } from "bun:test";
import { KEY0_URL } from "../fixtures/constants.ts";

describe("Invalid Plan", () => {
	test("nonexistent planId returns 400 TIER_NOT_FOUND", async () => {
		const res = await fetch(`${KEY0_URL}/x402/access`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				planId: "nonexistent-tier-xyz",
				requestId: crypto.randomUUID(),
				resourceId: "test-resource",
			}),
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body["code"]).toBe("TIER_NOT_FOUND");
	});

	test("missing planId returns 402 discovery response with all plans", async () => {
		// POST /x402/access with no planId triggers discovery mode:
		// returns 402 with all available plans (no PENDING record created)
		const res = await fetch(`${KEY0_URL}/x402/access`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ requestId: crypto.randomUUID() }),
		});

		expect(res.status).toBe(402);
		const body = (await res.json()) as Record<string, unknown>;
		// Discovery response contains all plans in accepts array
		expect(Array.isArray(body["accepts"])).toBe(true);
		expect((body["accepts"] as unknown[]).length).toBeGreaterThan(0);
		// No challengeId — this is pure discovery, no PENDING record
		expect(body["challengeId"]).toBeUndefined();
	});
});

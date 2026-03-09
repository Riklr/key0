import { describe, expect, test } from "bun:test";
import type { SellerConfig } from "../../types";
import { validateSellerConfig } from "../config-validation.js";

function makeValidConfig(overrides?: Partial<SellerConfig>): SellerConfig {
	return {
		agentName: "Test Agent",
		agentDescription: "Test",
		agentUrl: "https://agent.example.com",
		providerName: "Provider",
		providerUrl: "https://provider.example.com",
		walletAddress: `0x${"ab".repeat(20)}` as `0x${string}`,
		network: "testnet",
		plans: [
			{ planId: "single", displayName: "Single", unitAmount: "$0.10", resourceType: "photo" },
		],
		onVerifyResource: async () => true,
		fetchResourceCredentials: async (params) => ({
			token: `tok_${params.challengeId}`,
			expiresAt: new Date(Date.now() + 3600 * 1000),
		}),
		...overrides,
	};
}

describe("validateSellerConfig", () => {
	test("accepts valid config", () => {
		expect(() => validateSellerConfig(makeValidConfig())).not.toThrow();
	});

	test("rejects empty agentName", () => {
		expect(() => validateSellerConfig(makeValidConfig({ agentName: "" }))).toThrow(
			"agentName must not be empty",
		);
	});

	test("rejects empty agentUrl", () => {
		expect(() => validateSellerConfig(makeValidConfig({ agentUrl: "" }))).toThrow(
			"agentUrl must not be empty",
		);
	});

	test("rejects empty providerName", () => {
		expect(() => validateSellerConfig(makeValidConfig({ providerName: "" }))).toThrow(
			"providerName must not be empty",
		);
	});

	test("rejects invalid wallet address", () => {
		expect(() =>
			validateSellerConfig(makeValidConfig({ walletAddress: "not-an-address" as `0x${string}` })),
		).toThrow("walletAddress");
	});

	test("rejects invalid network", () => {
		expect(() => validateSellerConfig(makeValidConfig({ network: "devnet" as "testnet" }))).toThrow(
			"network must be",
		);
	});

	test("rejects missing fetchResourceCredentials", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({ fetchResourceCredentials: undefined as unknown as never }),
			),
		).toThrow("fetchResourceCredentials must be a function");
	});

	test("rejects non-function fetchResourceCredentials", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({ fetchResourceCredentials: "not-a-function" as unknown as never }),
			),
		).toThrow("fetchResourceCredentials must be a function");
	});

	test("rejects empty plans array", () => {
		expect(() => validateSellerConfig(makeValidConfig({ plans: [] }))).toThrow("at least one plan");
	});

	test("rejects plan with empty planId", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({
					plans: [{ planId: "", displayName: "X", unitAmount: "$0.10", resourceType: "photo" }],
				}),
			),
		).toThrow("non-empty planId");
	});

	test("rejects duplicate planIds", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({
					plans: [
						{ planId: "same", displayName: "A", unitAmount: "$0.10", resourceType: "photo" },
						{ planId: "same", displayName: "B", unitAmount: "$0.20", resourceType: "photo" },
					],
				}),
			),
		).toThrow('duplicate planId "same"');
	});

	test("rejects invalid plan unitAmount format", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({
					plans: [{ planId: "bad", displayName: "X", unitAmount: "0.10", resourceType: "photo" }],
				}),
			),
		).toThrow('invalid unitAmount "0.10"');
	});

	test("accepts multiple valid plans", () => {
		expect(() =>
			validateSellerConfig(
				makeValidConfig({
					plans: [
						{ planId: "basic", displayName: "Basic", unitAmount: "$0.10", resourceType: "photo" },
						{
							planId: "premium",
							displayName: "Premium",
							unitAmount: "$1.00",
							resourceType: "photo",
						},
					],
				}),
			),
		).not.toThrow();
	});
});

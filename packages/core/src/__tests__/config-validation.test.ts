import { describe, expect, test } from "bun:test";
import type { SellerConfig } from "@agentgate/types";
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
    products: [
      { tierId: "single", label: "Single", amount: "$0.10", resourceType: "photo" },
    ],
    accessTokenSecret: "a-very-long-secret-that-is-at-least-32-characters!",
    onVerifyResource: async () => true,
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
    expect(() =>
      validateSellerConfig(makeValidConfig({ network: "devnet" as "testnet" })),
    ).toThrow("network must be");
  });

  test("rejects short accessTokenSecret", () => {
    expect(() =>
      validateSellerConfig(makeValidConfig({ accessTokenSecret: "short" })),
    ).toThrow("at least 32 characters");
  });

  test("rejects empty products array", () => {
    expect(() =>
      validateSellerConfig(makeValidConfig({ products: [] })),
    ).toThrow("at least one tier");
  });

  test("rejects product with empty tierId", () => {
    expect(() =>
      validateSellerConfig(
        makeValidConfig({
          products: [{ tierId: "", label: "X", amount: "$0.10", resourceType: "photo" }],
        }),
      ),
    ).toThrow("non-empty tierId");
  });

  test("rejects duplicate tierIds", () => {
    expect(() =>
      validateSellerConfig(
        makeValidConfig({
          products: [
            { tierId: "same", label: "A", amount: "$0.10", resourceType: "photo" },
            { tierId: "same", label: "B", amount: "$0.20", resourceType: "photo" },
          ],
        }),
      ),
    ).toThrow('duplicate tierId "same"');
  });

  test("rejects invalid tier amount format", () => {
    expect(() =>
      validateSellerConfig(
        makeValidConfig({
          products: [
            { tierId: "bad", label: "X", amount: "0.10", resourceType: "photo" },
          ],
        }),
      ),
    ).toThrow('invalid amount "0.10"');
  });

  test("accepts multiple valid tiers", () => {
    expect(() =>
      validateSellerConfig(
        makeValidConfig({
          products: [
            { tierId: "basic", label: "Basic", amount: "$0.10", resourceType: "photo" },
            { tierId: "premium", label: "Premium", amount: "$1.00", resourceType: "photo" },
          ],
        }),
      ),
    ).not.toThrow();
  });
});

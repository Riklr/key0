import { describe, expect, test } from "bun:test";
import { AccessTokenIssuer } from "../access-token.js";

const SECRET = "a-very-long-secret-that-is-at-least-32-characters!";
const CLAIMS = {
  sub: "550e8400-e29b-41d4-a716-446655440000",
  jti: "660e8400-e29b-41d4-a716-446655440000",
  resourceId: "photo-42",
  tierId: "single",
  txHash: `0x${"ab".repeat(32)}`,
};

describe("AccessTokenIssuer", () => {
  test("constructor rejects short secret", () => {
    expect(() => new AccessTokenIssuer("short")).toThrow("at least 32 characters");
  });

  test("constructor accepts 32+ char secret", () => {
    expect(() => new AccessTokenIssuer(SECRET)).not.toThrow();
  });

  test("sign returns token and expiresAt", async () => {
    const issuer = new AccessTokenIssuer(SECRET);
    const result = await issuer.sign(CLAIMS, 3600);
    expect(result.token).toBeTypeOf("string");
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  test("verify returns correct claims", async () => {
    const issuer = new AccessTokenIssuer(SECRET);
    const { token } = await issuer.sign(CLAIMS, 3600);
    const decoded = await issuer.verify(token);
    expect(decoded.sub).toBe(CLAIMS.sub);
    expect(decoded.jti).toBe(CLAIMS.jti);
    expect(decoded.resourceId).toBe(CLAIMS.resourceId);
    expect(decoded.tierId).toBe(CLAIMS.tierId);
    expect(decoded.txHash).toBe(CLAIMS.txHash);
  });

  test("verify includes iat and exp", async () => {
    const issuer = new AccessTokenIssuer(SECRET);
    const { token } = await issuer.sign(CLAIMS, 3600);
    const decoded = await issuer.verify(token);
    expect(decoded.iat).toBeTypeOf("number");
    expect(decoded.exp).toBeTypeOf("number");
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  test("verify rejects tampered token", async () => {
    const issuer = new AccessTokenIssuer(SECRET);
    const { token } = await issuer.sign(CLAIMS, 3600);
    const tampered = `${token}x`;
    await expect(issuer.verify(tampered)).rejects.toThrow();
  });

  test("verify rejects token signed with different secret", async () => {
    const issuer1 = new AccessTokenIssuer(SECRET);
    const issuer2 = new AccessTokenIssuer("a-completely-different-secret-that-is-32-chars!");
    const { token } = await issuer1.sign(CLAIMS, 3600);
    await expect(issuer2.verify(token)).rejects.toThrow();
  });

  test("expiresAt is approximately ttl seconds in the future", async () => {
    const issuer = new AccessTokenIssuer(SECRET);
    const before = Date.now();
    const result = await issuer.sign(CLAIMS, 60);
    const after = Date.now();
    const expectedMin = before + 60 * 1000;
    const expectedMax = after + 60 * 1000;
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax + 1000);
  });
});

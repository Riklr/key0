import { SignJWT, jwtVerify } from "jose";

export type TokenClaims = {
	readonly sub: string; // requestId
	readonly jti: string; // challengeId
	readonly resourceId: string;
	readonly tierId: string;
	readonly txHash: string;
};

export type TokenResult = {
	readonly token: string;
	readonly expiresAt: Date;
};

export class AccessTokenIssuer {
	private readonly secret: Uint8Array;

	constructor(secretString: string) {
		if (secretString.length < 32) {
			throw new Error("ACCESS_TOKEN_SECRET must be at least 32 characters");
		}
		this.secret = new TextEncoder().encode(secretString);
	}

	async sign(claims: TokenClaims, ttlSeconds: number): Promise<TokenResult> {
		const now = Math.floor(Date.now() / 1000);
		const exp = now + ttlSeconds;

		const token = await new SignJWT({
			...claims,
		})
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt(now)
			.setExpirationTime(exp)
			.setSubject(claims.sub)
			.setJti(claims.jti)
			.sign(this.secret);

		return {
			token,
			expiresAt: new Date(exp * 1000),
		};
	}

	async verify(token: string): Promise<TokenClaims & { iat: number; exp: number }> {
		const { payload } = await jwtVerify(token, this.secret);
		return payload as TokenClaims & { iat: number; exp: number };
	}
}

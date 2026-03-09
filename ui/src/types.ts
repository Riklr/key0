export interface Plan {
	planId: string;
	displayName: string;
	unitAmount: string;
	resourceType: string;
	expiresIn: number | "";
}

export interface Config {
	// Required
	walletAddress: string;
	issueTokenApi: string;
	network: "testnet" | "mainnet";
	redisUrl: string;

	// Server
	port: string;
	basePath: string;

	// Agent Card
	agentName: string;
	agentDescription: string;
	agentUrl: string;
	providerName: string;
	providerUrl: string;

	// Plans
	plans: Plan[];

	// Challenge
	challengeTtlSeconds: string;

	// Token API Auth
	issueTokenApiSecret: string;

	// Settlement
	gasWalletPrivateKey: string;

	// Refund cron
	walletPrivateKey: string;
	refundIntervalMs: string;
	refundMinAgeMs: string;
}

export const defaultConfig: Config = {
	walletAddress: "",
	issueTokenApi: "",
	network: "testnet",
	redisUrl: "redis://redis:6379",

	port: "3000",
	basePath: "/a2a",

	agentName: "Key2a Server",
	agentDescription: "Payment-gated A2A endpoint",
	agentUrl: "http://localhost:3000",
	providerName: "",
	providerUrl: "",

	plans: [
		{
			planId: "basic",
			displayName: "Basic",
			unitAmount: "$0.10",
			resourceType: "api",
			expiresIn: 3600,
		},
	],

	challengeTtlSeconds: "900",

	issueTokenApiSecret: "",

	gasWalletPrivateKey: "",

	walletPrivateKey: "",
	refundIntervalMs: "60000",
	refundMinAgeMs: "300000",
};

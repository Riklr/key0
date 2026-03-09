export interface ProductTier {
	tierId: string;
	label: string;
	amount: string;
	resourceType: string;
	accessDurationSeconds: number | "";
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

	// Products
	products: ProductTier[];

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

	products: [
		{
			tierId: "basic",
			label: "Basic",
			amount: "$0.10",
			resourceType: "api",
			accessDurationSeconds: 3600,
		},
	],

	challengeTtlSeconds: "900",

	issueTokenApiSecret: "",

	gasWalletPrivateKey: "",

	walletPrivateKey: "",
	refundIntervalMs: "60000",
	refundMinAgeMs: "300000",
};

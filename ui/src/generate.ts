import type { Config } from "./types";

export function generateEnv(config: Config): string {
	const lines: string[] = [
		"# ──────────────────────────────────────────────────────────────────────────────",
		"# Key2a Docker — Generated Configuration",
		"# ──────────────────────────────────────────────────────────────────────────────",
		"",
		"# ── Required ──────────────────────────────────────────────────────────────────",
		"",
		`KEY2A_WALLET_ADDRESS=${config.walletAddress}`,
		`ISSUE_TOKEN_API=${config.issueTokenApi}`,
		`REDIS_URL=${config.redisUrl}`,
		"",
		"# ── Network ───────────────────────────────────────────────────────────────────",
		"",
		`KEY2A_NETWORK=${config.network}`,
		"",
		"# ── Server ────────────────────────────────────────────────────────────────────",
		"",
		`PORT=${config.port}`,
	];

	if (config.basePath && config.basePath !== "/a2a") {
		lines.push(`BASE_PATH=${config.basePath}`);
	}

	lines.push(
		"",
		"# ── Agent Card ────────────────────────────────────────────────────────────────",
		"",
		`AGENT_NAME=${config.agentName}`,
		`AGENT_DESCRIPTION=${config.agentDescription}`,
		`AGENT_URL=${config.agentUrl}`,
	);

	if (config.providerName) {
		lines.push(`PROVIDER_NAME=${config.providerName}`);
	}
	if (config.providerUrl) {
		lines.push(`PROVIDER_URL=${config.providerUrl}`);
	}

	// Plans
	if (config.plans.length > 0) {
		const plansJson = JSON.stringify(
			config.plans.map((p) => ({
				planId: p.planId,
				displayName: p.displayName,
				unitAmount: p.unitAmount,
				resourceType: p.resourceType,
				...(p.expiresIn !== "" ? { expiresIn: Number(p.expiresIn) } : {}),
			})),
			null,
			2,
		);
		lines.push(
			"",
			"# ── Pricing Plans ─────────────────────────────────────────────────────────────",
			"",
			`PLANS='${plansJson}'`,
		);
	}

	if (config.challengeTtlSeconds && config.challengeTtlSeconds !== "900") {
		lines.push(
			"",
			"# ── Challenge ─────────────────────────────────────────────────────────────────",
			"",
			`CHALLENGE_TTL_SECONDS=${config.challengeTtlSeconds}`,
		);
	}

	if (config.issueTokenApiSecret) {
		lines.push(
			"",
			"# ── Token API Auth ────────────────────────────────────────────────────────────",
			"",
			`ISSUE_TOKEN_API_SECRET=${config.issueTokenApiSecret}`,
		);
	}

	if (config.gasWalletPrivateKey) {
		lines.push(
			"",
			"# ── Settlement ────────────────────────────────────────────────────────────────",
			"",
			`GAS_WALLET_PRIVATE_KEY=${config.gasWalletPrivateKey}`,
		);
	}

	if (config.walletPrivateKey) {
		lines.push(
			"",
			"# ── Refund Cron ───────────────────────────────────────────────────────────────",
			"",
			`KEY2A_WALLET_PRIVATE_KEY=${config.walletPrivateKey}`,
		);
		if (config.refundIntervalMs !== "60000") {
			lines.push(`REFUND_INTERVAL_MS=${config.refundIntervalMs}`);
		}
		if (config.refundMinAgeMs !== "300000") {
			lines.push(`REFUND_MIN_AGE_MS=${config.refundMinAgeMs}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

export function generateDockerRun(config: Config): string {
	const envFlags: string[] = [];

	envFlags.push(`-e KEY2A_WALLET_ADDRESS=${config.walletAddress}`);
	envFlags.push(`-e ISSUE_TOKEN_API=${config.issueTokenApi}`);
	envFlags.push(`-e REDIS_URL=${config.redisUrl}`);
	envFlags.push(`-e KEY2A_NETWORK=${config.network}`);
	envFlags.push(`-e PORT=${config.port}`);
	envFlags.push(`-e AGENT_NAME="${config.agentName}"`);
	envFlags.push(`-e AGENT_DESCRIPTION="${config.agentDescription}"`);
	envFlags.push(`-e AGENT_URL=${config.agentUrl}`);

	if (config.basePath && config.basePath !== "/a2a") {
		envFlags.push(`-e BASE_PATH=${config.basePath}`);
	}
	if (config.providerName) {
		envFlags.push(`-e PROVIDER_NAME="${config.providerName}"`);
	}
	if (config.providerUrl) {
		envFlags.push(`-e PROVIDER_URL=${config.providerUrl}`);
	}
	if (config.plans.length > 0) {
		const json = JSON.stringify(
			config.plans.map((p) => ({
				planId: p.planId,
				displayName: p.displayName,
				unitAmount: p.unitAmount,
				resourceType: p.resourceType,
				...(p.expiresIn !== "" ? { expiresIn: Number(p.expiresIn) } : {}),
			})),
		);
		envFlags.push(`-e PLANS='${json}'`);
	}
	if (config.challengeTtlSeconds !== "900") {
		envFlags.push(`-e CHALLENGE_TTL_SECONDS=${config.challengeTtlSeconds}`);
	}
	if (config.issueTokenApiSecret) {
		envFlags.push(`-e ISSUE_TOKEN_API_SECRET=${config.issueTokenApiSecret}`);
	}
	if (config.gasWalletPrivateKey) {
		envFlags.push(`-e GAS_WALLET_PRIVATE_KEY=${config.gasWalletPrivateKey}`);
	}
	if (config.walletPrivateKey) {
		envFlags.push(`-e KEY2A_WALLET_PRIVATE_KEY=${config.walletPrivateKey}`);
	}

	return `docker run \\\n  ${envFlags.join(" \\\n  ")} \\\n  -p ${config.port}:${config.port} \\\n  riklr/key2a:latest`;
}

export function generateDockerCompose(config: Config): string {
	const envVars: Record<string, string> = {
		KEY2A_WALLET_ADDRESS: config.walletAddress,
		ISSUE_TOKEN_API: config.issueTokenApi,
		KEY2A_NETWORK: config.network,
		PORT: config.port,
		AGENT_NAME: config.agentName,
		AGENT_DESCRIPTION: config.agentDescription,
		AGENT_URL: config.agentUrl,
		REDIS_URL: "redis://redis:6379",
	};

	if (config.basePath && config.basePath !== "/a2a") {
		envVars.BASE_PATH = config.basePath;
	}
	if (config.providerName) envVars.PROVIDER_NAME = config.providerName;
	if (config.providerUrl) envVars.PROVIDER_URL = config.providerUrl;
	if (config.plans.length > 0) {
		envVars.PLANS = JSON.stringify(
			config.plans.map((p) => ({
				planId: p.planId,
				displayName: p.displayName,
				unitAmount: p.unitAmount,
				resourceType: p.resourceType,
				...(p.expiresIn !== "" ? { expiresIn: Number(p.expiresIn) } : {}),
			})),
		);
	}
	if (config.challengeTtlSeconds !== "900") {
		envVars.CHALLENGE_TTL_SECONDS = config.challengeTtlSeconds;
	}
	if (config.issueTokenApiSecret) {
		envVars.ISSUE_TOKEN_API_SECRET = config.issueTokenApiSecret;
	}
	if (config.gasWalletPrivateKey) {
		envVars.GAS_WALLET_PRIVATE_KEY = config.gasWalletPrivateKey;
	}
	if (config.walletPrivateKey) {
		envVars.KEY2A_WALLET_PRIVATE_KEY = config.walletPrivateKey;
		if (config.refundIntervalMs !== "60000") {
			envVars.REFUND_INTERVAL_MS = config.refundIntervalMs;
		}
		if (config.refundMinAgeMs !== "300000") {
			envVars.REFUND_MIN_AGE_MS = config.refundMinAgeMs;
		}
	}

	const envLines = Object.entries(envVars)
		.map(([k, v]) => `      ${k}: "${v}"`)
		.join("\n");

	return `services:
  key2a:
    image: riklr/key2a:latest
    ports:
      - "${config.port}:${config.port}"
    environment:
${envLines}
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
`;
}

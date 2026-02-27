export type PaymentProtocol = "x402" | "stripe" | "lightning";

export type SkillPricing = {
	readonly tierId: string;
	readonly label: string;
	readonly amount: string; // "$0.10" — human-readable USD, settled as USDC
	readonly asset: "USDC";
	readonly chainId: number; // 8453 (Base) or 84532 (Base Sepolia)
	readonly walletAddress: `0x${string}`;
};

export type AgentSkillInputSchema = {
	readonly type: "object";
	readonly properties: Record<
		string,
		{
			readonly type: string;
			readonly description?: string;
		}
	>;
	readonly required?: readonly string[];
};

export type AgentSkill = {
	readonly id: string; // "request-access" | "submit-proof"
	readonly name: string;
	readonly description: string;
	readonly tags: readonly string[];
	readonly inputSchema: AgentSkillInputSchema;
	readonly outputSchema: AgentSkillInputSchema;
	readonly pricing?: readonly SkillPricing[];
};

export type AgentCard = {
	readonly name: string;
	readonly description: string;
	readonly url: string;
	readonly version: string;
	readonly capabilities: {
		readonly a2a: true;
		readonly paymentProtocols: readonly PaymentProtocol[];
	};
	readonly defaultInputModes: readonly string[];
	readonly defaultOutputModes: readonly string[];
	readonly skills: readonly AgentSkill[];
	readonly provider: {
		readonly name: string;
		readonly url: string;
	};
};

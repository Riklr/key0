import {
	AccessTokenIssuer,
	ChallengeEngine,
	InMemoryChallengeStore,
	InMemorySeenTxStore,
	buildAgentCard,
} from "@agentgate/core";
import type {
	AgentCard,
	IChallengeStore,
	IPaymentAdapter,
	ISeenTxStore,
	SellerConfig,
} from "@agentgate/types";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { AgentGateExecutor } from "./executor.js";

export type AgentGateConfig = {
	readonly config: SellerConfig;
	readonly adapter: IPaymentAdapter;
	readonly store?: IChallengeStore | undefined;
	readonly seenTxStore?: ISeenTxStore | undefined;
};

export type AgentGateInstance = {
	requestHandler: DefaultRequestHandler;
	agentCard: AgentCard;
	engine: ChallengeEngine;
	executor: AgentGateExecutor;
};

export function createAgentGate(opts: AgentGateConfig): AgentGateInstance {
	const store = opts.store ?? new InMemoryChallengeStore();
	const seenTxStore = opts.seenTxStore ?? new InMemorySeenTxStore();
	const tokenIssuer = new AccessTokenIssuer(opts.config.accessTokenSecret);

	const engine = new ChallengeEngine({
		config: opts.config,
		store,
		seenTxStore,
		adapter: opts.adapter,
		tokenIssuer,
	});

	const executor = new AgentGateExecutor(engine);
	const agentCard = buildAgentCard(opts.config);

	const requestHandler = new DefaultRequestHandler(
		agentCard as any, // Cast because our AgentCard type might have extra/different fields vs SDK's strict type
		new InMemoryTaskStore(),
		executor,
	);

	return { requestHandler, agentCard, engine, executor };
}

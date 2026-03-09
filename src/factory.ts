import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { buildAgentCard, ChallengeEngine } from "./core/index.js";
import { Key2aExecutor } from "./executor.js";
import type {
	AgentCard,
	IChallengeStore,
	IPaymentAdapter,
	ISeenTxStore,
	SellerConfig,
} from "./types/index.js";

export type Key2aConfig = {
	readonly config: SellerConfig;
	readonly adapter: IPaymentAdapter;
	readonly store: IChallengeStore;
	readonly seenTxStore: ISeenTxStore;
};

export type Key2aInstance = {
	requestHandler: DefaultRequestHandler;
	agentCard: AgentCard;
	engine: ChallengeEngine;
	executor: Key2aExecutor;
};

export function createKey2a(opts: Key2aConfig): Key2aInstance {
	if (!opts.store) {
		throw new Error(
			"[Key2a] store is required. Use RedisChallengeStore for production.\n" +
				"  import { RedisChallengeStore } from '@riklr/key2a';\n" +
				"  const store = new RedisChallengeStore({ redis });",
		);
	}
	if (!opts.seenTxStore) {
		throw new Error(
			"[Key2a] seenTxStore is required. Use RedisSeenTxStore for production.\n" +
				"  import { RedisSeenTxStore } from '@riklr/key2a';\n" +
				"  const seenTxStore = new RedisSeenTxStore({ redis });",
		);
	}
	const store = opts.store;
	const seenTxStore = opts.seenTxStore;

	const engine = new ChallengeEngine({
		config: opts.config,
		store,
		seenTxStore,
		adapter: opts.adapter,
	});

	const executor = new Key2aExecutor(engine, opts.config);
	const agentCard = buildAgentCard(opts.config);

	const requestHandler = new DefaultRequestHandler(
		agentCard as any,
		new InMemoryTaskStore(),
		executor,
	);

	return { requestHandler, agentCard, engine, executor };
}

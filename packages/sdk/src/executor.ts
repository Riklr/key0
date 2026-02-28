import type {
	AgentExecutor,
	ExecutionEventBus,
	Message,
	RequestContext,
	Task,
} from "@a2a-js/sdk";
import type { ChallengeEngine } from "./core/index.js";
import type { AccessRequest, PaymentProof } from "./types/index.js";
import { v4 as uuidv4 } from "uuid";

export class AgentGateExecutor implements AgentExecutor {
	constructor(private engine: ChallengeEngine) {}

	async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
		const { taskId, contextId, userMessage } = context;

		// Find data part
		const dataPart = userMessage.parts.find((p) => p.kind === "data");
		if (!dataPart) {
			throw new Error("No data part found in message");
		}

		// The data field in A2A SDK is typed as unknown or similar, cast it
		const payload = dataPart.data as Record<string, unknown>;
		let resultData: unknown;

		try {
			// Route by type or shape
			if (payload.type === "AccessRequest" || this.isAccessRequest(payload)) {
				resultData = await this.engine.requestAccess(payload as unknown as AccessRequest);
			} else if (payload.type === "PaymentProof" || this.isPaymentProof(payload)) {
				resultData = await this.engine.submitProof(payload as unknown as PaymentProof);
			} else {
				throw new Error(`Unknown message type: ${payload.type}`);
			}

			// Success - Publish task completion and result message
			const taskUpdate: Task = {
				kind: "task",
				id: taskId,
				contextId,
				status: {
					state: "completed",
					timestamp: new Date().toISOString(),
				},
				history: [userMessage],
			};
			eventBus.publish(taskUpdate);

			const responseMessage: Message = {
				kind: "message",
				messageId: uuidv4(),
				role: "agent",
				contextId,
				parts: [
					{
						kind: "data",
						data: resultData as Record<string, unknown>,
						mimeType: "application/json",
					},
				],
			};
			eventBus.publish(responseMessage);
		} catch (err: unknown) {
			// Handle error - update task to failed
			const failedTask: Task = {
				kind: "task",
				id: taskId,
				contextId,
				status: {
					state: "failed",
					timestamp: new Date().toISOString(),
				},
				history: [userMessage],
			};
			eventBus.publish(failedTask);

			// Send error message
			const errorMessage: Message = {
				kind: "message",
				messageId: uuidv4(),
				role: "agent",
				contextId,
				parts: [
					{
						kind: "text",
						text: err instanceof Error ? err.message : String(err),
					},
				],
			};
			eventBus.publish(errorMessage);
		} finally {
			eventBus.finished();
		}
	}

	async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
		// No-op for now as tasks are synchronous
	}

	private isAccessRequest(data: Record<string, unknown>): boolean {
		return (
			typeof data["requestId"] === "string" &&
			typeof data["resourceId"] === "string" &&
			typeof data["tierId"] === "string" &&
			typeof data["clientAgentId"] === "string"
		);
	}

	private isPaymentProof(data: Record<string, unknown>): boolean {
		return (
			typeof data["challengeId"] === "string" &&
			typeof data["txHash"] === "string" &&
			typeof data["chainId"] === "number"
		);
	}
}

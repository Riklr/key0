/**
 * A2A protocol types for tasks/send.
 * Reference: https://google.github.io/A2A/
 */

export type A2ATaskSendRequest = {
	readonly jsonrpc: "2.0";
	readonly id: string | number;
	readonly method: "tasks/send";
	readonly params: {
		readonly id: string; // task ID
		readonly message: {
			readonly role: "user";
			readonly parts: readonly A2AMessagePart[];
		};
		readonly metadata?: Record<string, unknown>;
	};
};

export type A2AMessagePart =
	| { readonly type: "text"; readonly text: string }
	| {
			readonly type: "data";
			readonly data: Record<string, unknown>;
			readonly mimeType: "application/json";
	  };

export type A2ATaskStatus = "submitted" | "working" | "input-required" | "completed" | "failed";

export type A2ATaskSendResponse = {
	readonly jsonrpc: "2.0";
	readonly id: string | number;
	readonly result: {
		readonly id: string;
		readonly status: {
			readonly state: A2ATaskStatus;
			readonly message?: {
				readonly role: "agent";
				readonly parts: readonly A2AMessagePart[];
			};
		};
		readonly artifacts?: readonly {
			readonly name: string;
			readonly parts: readonly A2AMessagePart[];
		}[];
	};
};

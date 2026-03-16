// These constants are replaced by buildCli() at build time.
// When running tests, they have placeholder values.
export const CLI_NAME = "__CLI_NAME__";
export const CLI_URL = "__CLI_URL__";

export type ParsedArgs =
	| { command: "discover" }
	| { command: "request"; plan: string; resource?: string; paymentSignature?: string }
	| { command: "help" }
	| { command: "version" }
	| { command: "error"; message: string };

export function parseCli(args: string[]): ParsedArgs {
	if (args.length === 0) {
		return { command: "help" };
	}

	const first = args[0];

	if (first === "--help" || first === "-h") {
		return { command: "help" };
	}

	if (first === "--version" || first === "-v") {
		return { command: "version" };
	}

	if (first === "discover") {
		return { command: "discover" };
	}

	if (first === "request") {
		const rest = args.slice(1);
		let plan: string | undefined;
		let resource: string | undefined;
		let paymentSignature: string | undefined;

		for (let i = 0; i < rest.length; i++) {
			const flag = rest[i];
			const value = rest[i + 1];

			if (flag === "--plan") {
				plan = value;
				i++;
			} else if (flag === "--resource") {
				resource = value;
				i++;
			} else if (flag === "--payment-signature") {
				paymentSignature = value;
				i++;
			}
		}

		if (plan === undefined) {
			return { command: "error", message: "Missing required flag: --plan" };
		}

		return {
			command: "request" as const,
			plan,
			...(resource !== undefined && { resource }),
			...(paymentSignature !== undefined && { paymentSignature }),
		};
	}

	return { command: "error", message: `Unknown command: "${first}"` };
}

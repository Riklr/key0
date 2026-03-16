import { describe, expect, test } from "bun:test";
import { parseCli } from "../cli-template.js";

describe("parseCli", () => {
	test("parses 'discover' command", () => {
		const result = parseCli(["discover"]);
		expect(result).toEqual({ command: "discover" });
	});

	test("parses 'request --plan single-photo'", () => {
		const result = parseCli(["request", "--plan", "single-photo"]);
		expect(result).toEqual({ command: "request", plan: "single-photo" });
	});

	test("parses 'request --plan single-photo --resource img-123'", () => {
		const result = parseCli(["request", "--plan", "single-photo", "--resource", "img-123"]);
		expect(result).toEqual({ command: "request", plan: "single-photo", resource: "img-123" });
	});

	test("parses 'request --plan single-photo --payment-signature eyJhbG...'", () => {
		const result = parseCli([
			"request",
			"--plan",
			"single-photo",
			"--payment-signature",
			"eyJhbGciOiJIUzI1NiJ9",
		]);
		expect(result).toEqual({
			command: "request",
			plan: "single-photo",
			paymentSignature: "eyJhbGciOiJIUzI1NiJ9",
		});
	});

	test("parses '--help'", () => {
		const result = parseCli(["--help"]);
		expect(result).toEqual({ command: "help" });
	});

	test("parses '--version'", () => {
		const result = parseCli(["--version"]);
		expect(result).toEqual({ command: "version" });
	});

	test("returns error for unknown command", () => {
		const result = parseCli(["foobar"]);
		expect(result).toEqual({ command: "error", message: 'Unknown command: "foobar"' });
	});

	test("returns error when request missing --plan", () => {
		const result = parseCli(["request"]);
		expect(result).toEqual({ command: "error", message: "Missing required flag: --plan" });
	});

	test("returns help for no arguments", () => {
		const result = parseCli([]);
		expect(result).toEqual({ command: "help" });
	});
});

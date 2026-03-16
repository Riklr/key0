import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCli, generateCliSource } from "../cli.js";

describe("generateCliSource", () => {
	test("replaces __CLI_NAME__ and __CLI_URL__ placeholders", () => {
		const source = generateCliSource("mycli", "https://api.example.com");
		expect(source).toContain('"mycli"');
		expect(source).toContain('"https://api.example.com"');
		// The constant declaration must be replaced
		expect(source).not.toContain('export const CLI_NAME = "__CLI_NAME__"');
		// The IS_MAIN sentinel must survive
		expect(source).toContain('CLI_NAME !== "__CLI_NAME__"');
		expect(source).not.toContain('export const CLI_URL = "__CLI_URL__"');
	});

	test("preserves all other code unchanged", () => {
		const source = generateCliSource("testcli", "https://test.com");
		expect(source).toContain("parseCli");
		expect(source).toContain("runDiscover");
		expect(source).toContain("runRequest");
		expect(source).toContain("runMain");
	});

	test("trims trailing slash from URL", () => {
		const source = generateCliSource("mycli", "https://api.example.com/");
		expect(source).toContain('"https://api.example.com"');
		expect(source).not.toContain('"https://api.example.com/"');
	});
});

describe("buildCli", () => {
	let outputDir: string;

	beforeAll(() => {
		outputDir = mkdtempSync(join(tmpdir(), "cli-build-test-"));
	});

	afterAll(() => {
		rmSync(outputDir, { recursive: true, force: true });
	});

	test("compiles a binary for the current platform", async () => {
		const result = await buildCli({
			name: "testcli",
			url: "https://api.example.com",
			targets: [], // empty = current platform
			outputDir,
		});

		expect(result.binaries.length).toBe(1);
		expect(existsSync(result.binaries[0]!.path)).toBe(true);
		expect(result.binaries[0]!.size).toBeGreaterThan(0);
	}, 120_000); // compilation takes time

	test("compiled binary outputs --help as JSON with correct name and url", async () => {
		const result = await buildCli({
			name: "testcli",
			url: "https://api.example.com",
			targets: [],
			outputDir,
		});

		const binaryPath = result.binaries[0]!.path;
		const proc = Bun.spawn([binaryPath, "--help"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		await proc.exited;

		const output = JSON.parse(stdout);
		expect(output.name).toBe("testcli");
		expect(output.url).toBe("https://api.example.com");
		expect(output.commands).toHaveProperty("discover");
		expect(output.commands).toHaveProperty("request");
	}, 120_000);
});

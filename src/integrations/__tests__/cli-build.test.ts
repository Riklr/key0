import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCli, generateCliSource } from "../cli.js";
import { parseCli, runInstall } from "../cli-template.js";

describe("parseCli", () => {
	test("--install returns install command", () => {
		expect(parseCli(["--install"])).toEqual({ command: "install" });
	});
});

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

describe("runInstall", () => {
	let fakeBinary: string;
	let tmpBase: string;

	beforeAll(async () => {
		tmpBase = mkdtempSync(join(tmpdir(), "install-test-"));
		fakeBinary = join(tmpBase, "fake-binary");
		await Bun.write(fakeBinary, "#!/bin/sh\necho hello");
		chmodSync(fakeBinary, 0o755);
	});

	afterAll(() => {
		rmSync(tmpBase, { recursive: true, force: true });
	});

	test("installs to localBinDir when writable", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: false,
				pathEnv: localDir,
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(0);
			expect(result.output["installed"]).toBe(join(localDir, "my-agent"));
			expect(result.output["inPath"]).toBe(true);
			expect(result.output["addToPath"]).toBeTypeOf("string");
			expect(result.output["addToPath"] as string).toContain(localDir);
			const mode = statSync(join(localDir, "my-agent")).mode;
			expect(mode & 0o755).toBe(0o755);
		} finally {
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});

	test("falls through to systemBinDir when localBinDir is not writable", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			chmodSync(localDir, 0o555);
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: false,
				pathEnv: systemDir,
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(0);
			expect(result.output["installed"]).toBe(join(systemDir, "my-agent"));
			expect(result.output["addToPath"]).toBeUndefined();
		} finally {
			chmodSync(localDir, 0o755);
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});

	test("returns PERMISSION_DENIED when both dirs are not writable", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			chmodSync(localDir, 0o555);
			chmodSync(systemDir, 0o555);
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: false,
				pathEnv: "",
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(1);
			expect(result.output["code"]).toBe("PERMISSION_DENIED");
		} finally {
			chmodSync(localDir, 0o755);
			chmodSync(systemDir, 0o755);
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});

	test("returns UNSUPPORTED_PLATFORM on Windows", async () => {
		const result = await runInstall("my-agent", { platform: "win32", execPath: fakeBinary });
		expect(result.exitCode).toBe(1);
		expect(result.output["code"]).toBe("UNSUPPORTED_PLATFORM");
	});

	test("skips localBinDir and installs to systemBinDir when root", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: true,
				pathEnv: systemDir,
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(0);
			expect(result.output["installed"]).toBe(join(systemDir, "my-agent"));
			expect(result.output["addToPath"]).toBeUndefined();
		} finally {
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});

	test("inPath is false and addToPath is present when install dir not in PATH", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: false,
				pathEnv: "/usr/bin:/usr/local/bin",
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(0);
			expect(result.output["inPath"]).toBe(false);
			expect(result.output["addToPath"]).toBeTypeOf("string");
		} finally {
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});

	test("addToPath is absent when installed to systemBinDir", async () => {
		const localDir = mkdtempSync(join(tmpdir(), "local-bin-"));
		const systemDir = mkdtempSync(join(tmpdir(), "system-bin-"));
		try {
			chmodSync(localDir, 0o555);
			const result = await runInstall("my-agent", {
				localBinDir: localDir,
				systemBinDir: systemDir,
				platform: "linux",
				isRoot: false,
				pathEnv: systemDir,
				execPath: fakeBinary,
			});
			expect(result.exitCode).toBe(0);
			expect(result.output["addToPath"]).toBeUndefined();
		} finally {
			chmodSync(localDir, 0o755);
			rmSync(localDir, { recursive: true, force: true });
			rmSync(systemDir, { recursive: true, force: true });
		}
	});
});

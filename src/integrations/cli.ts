import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Read the CLI template and replace placeholder constants with actual values.
 * Returns the TypeScript source ready for compilation.
 *
 * Note: resolves cli-template.ts relative to this file's __dirname.
 * Requires Bun runtime (bun build --compile is used for compilation).
 */
export function generateCliSource(name: string, url: string): string {
	const templatePath = join(__dirname, "cli-template.ts");
	let source = readFileSync(templatePath, "utf-8");

	const cleanUrl = url.replace(/\/$/, "");

	source = source.replace(
		'export const CLI_NAME = "__CLI_NAME__";',
		`export const CLI_NAME = ${JSON.stringify(name)};`,
	);
	source = source.replace(
		'export const CLI_URL = "__CLI_URL__";',
		`export const CLI_URL = ${JSON.stringify(cleanUrl)};`,
	);

	return source;
}

export interface BuildCliOptions {
	/** Binary name, e.g. "mycli" */
	name: string;
	/** Seller's API URL, e.g. "https://api.example.com" */
	url: string;
	/** Bun compile targets. Empty array = current platform only. Defaults to ["bun-linux-x64", "bun-darwin-arm64", "bun-darwin-x64"] */
	targets?: string[];
	/** Output directory. Defaults to "./dist/cli" */
	outputDir?: string;
}

export interface BuildCliResult {
	binaries: Array<{
		path: string;
		target: string;
		size: number;
	}>;
}

export async function buildCli(opts: BuildCliOptions): Promise<BuildCliResult> {
	const targets = opts.targets ?? ["bun-linux-x64", "bun-darwin-arm64", "bun-darwin-x64"];
	const outputDir = opts.outputDir ?? "./dist/cli";

	mkdirSync(outputDir, { recursive: true });

	const tmpDir = mkdtempSync(join(tmpdir(), "key0-cli-"));
	try {
		const source = generateCliSource(opts.name, opts.url);
		const tmpFile = join(tmpDir, "cli-entry.ts");
		writeFileSync(tmpFile, source, "utf-8");

		const binaries: BuildCliResult["binaries"] = [];

		if (targets.length === 0) {
			// Compile for current platform, no --target flag
			const outPath = join(outputDir, opts.name);
			const args = ["build", "--compile", tmpFile, "--outfile", outPath];
			const proc = Bun.spawn(["bun", ...args], {
				stdout: "ignore",
				stderr: "pipe",
			});
			await proc.exited;
			if (proc.exitCode !== 0) {
				const stderr = await new Response(proc.stderr).text();
				throw new Error(`bun build --compile failed: ${stderr}`);
			}
			const size = statSync(outPath).size;
			binaries.push({ path: outPath, target: "current", size });
		} else {
			for (const target of targets) {
				const suffix = target.replace(/^bun-/, "");
				const outPath = join(outputDir, `${opts.name}-${suffix}`);
				const args = ["build", "--compile", `--target=${target}`, tmpFile, "--outfile", outPath];
				const proc = Bun.spawn(["bun", ...args], {
					stdout: "ignore",
					stderr: "pipe",
				});
				await proc.exited;
				if (proc.exitCode !== 0) {
					const stderr = await new Response(proc.stderr).text();
					throw new Error(`bun build --compile failed for target ${target}: ${stderr}`);
				}
				const size = statSync(outPath).size;
				binaries.push({ path: outPath, target, size });
			}
		}

		return { binaries };
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
}

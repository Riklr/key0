/**
 * Build a standalone CLI binary for your Key0 service.
 *
 * Edit the config below, then run:
 *   bun run build-cli.ts
 *
 * Output: ./dist/cli/<name>[-<platform>]
 */

import { buildCli } from "@key0ai/key0/cli";

const result = await buildCli({
	name: "key0-agent",
	url: "http://localhost:3001",
	// Optional: cross-compile for multiple platforms.
	// Omit (or set to []) to build for the current platform only.
	// targets: ["bun-linux-x64", "bun-darwin-arm64", "bun-darwin-x64"],
	outputDir: "./dist/cli",
});

for (const bin of result.binaries) {
	const mb = (bin.size / 1024 / 1024).toFixed(1);
	console.log(`  ✓ ${bin.path}  (${mb} MB)`);
}

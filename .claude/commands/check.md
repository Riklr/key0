---
description: Run typecheck + lint as the pre-commit sanity check
allowed-tools: Bash
---

Run `bun run typecheck && bun run lint` together as the pre-commit sanity check.

If lint fails, fix with: `bunx biome check --write .`

If typecheck fails on `noImplicitAnyLet` errors, add explicit type annotations to the flagged variables — do not use `any`.

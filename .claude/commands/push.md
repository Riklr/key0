---
description: Review README, update if needed, then push
allowed-tools: Bash, Read, Edit
---

Before pushing, review README.md against what's actually being pushed:

1. Run `git diff origin/$(git rev-parse --abbrev-ref HEAD)...HEAD --stat` to see what's changing.

2. Read the affected sections of README.md and decide whether they still accurately describe:
   - Installation / quick-start commands
   - Configuration options and env vars
   - Architecture or data flow
   - Any new files, endpoints, or features

3. If README is out of date, edit it now. Keep changes minimal — only update what is factually wrong or missing.

4. If you updated README.md:
   - `git add README.md`
   - `git commit -m "docs: update README for <brief description of what changed>"`

5. Run `git push`.

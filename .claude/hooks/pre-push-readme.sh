#!/usr/bin/env bash
# Pre-push hook: blocks git push if README.md was not updated alongside
# meaningful source changes in the commits being pushed.
#
# Exit 0 = allow push
# Exit 2 = block push, stdout is shown to Claude as the reason

# Read tool input JSON from stdin
INPUT=$(cat)

# Extract the bash command being run
COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null)

# Only intercept git push commands
if ! echo "$COMMAND" | grep -qE "git push"; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Determine the current branch and its remote tracking ref
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
REMOTE_REF="origin/$BRANCH"

# If the remote ref doesn't exist yet (first push), allow it
if ! git rev-parse --verify "$REMOTE_REF" >/dev/null 2>&1; then
  exit 0
fi

# Get files changed in commits being pushed
PENDING=$(git diff "$REMOTE_REF"...HEAD --name-only 2>/dev/null)

# Nothing pending? Let it through (e.g. already up to date)
if [ -z "$PENDING" ]; then
  exit 0
fi

# Check if any meaningful source files changed
MEANINGFUL=$(echo "$PENDING" | grep -E "^(src/|docker/|\.github/|Dockerfile|package\.json)" || true)

# If no meaningful changes, README review is not required
if [ -z "$MEANINGFUL" ]; then
  exit 0
fi

# If README.md is already among the pending changes, allow push
if echo "$PENDING" | grep -q "^README\.md$"; then
  exit 0
fi

# Block and explain
echo "README_REVIEW_REQUIRED: The following source files are being pushed but README.md was not updated:"
echo ""
echo "$MEANINGFUL"
echo ""
echo "Please review README.md and update it if any of these changes affect usage, configuration, or architecture."
echo "After updating README.md, commit it and re-run the push."
exit 2

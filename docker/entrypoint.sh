#!/bin/sh
# AgentGate Docker Entrypoint
# Loads saved config if present, then starts the server.
# Exit code 42 = restart (used after setup UI saves config).

ENV_FILE="/app/.env.runtime"

while true; do
  # Source saved env vars if they exist
  if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
  fi

  bun run docker/server.ts
  EXIT_CODE=$?

  if [ "$EXIT_CODE" -ne 42 ]; then
    exit "$EXIT_CODE"
  fi

  echo "[agentgate] Restarting with new configuration..."
  sleep 1
done

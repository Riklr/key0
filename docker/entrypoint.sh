#!/bin/sh
# Key0 Docker Entrypoint
# Loads saved config if present, then starts the server.
# Exit code 42 = restart (used after setup UI saves config).

CONFIG_DIR="/app/config"
ENV_FILE="$CONFIG_DIR/.env.runtime"

# Ensure config dir exists (volume mount point)
mkdir -p "$CONFIG_DIR"

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

  echo "[key0] Restarting with new configuration..."
  sleep 1
done

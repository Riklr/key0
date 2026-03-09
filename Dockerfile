FROM oven/bun:1-alpine AS ui-build
WORKDIR /ui
COPY ui/package.json ui/bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY ui/ .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Copy source
COPY src/ ./src/
COPY docker/server.ts ./docker/server.ts
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# Copy built UI
COPY --from=ui-build /ui/dist ./ui/dist

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["./docker/entrypoint.sh"]

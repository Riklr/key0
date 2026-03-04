FROM oven/bun:1-alpine
WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source
COPY src/ ./src/
COPY docker/server.ts ./docker/server.ts

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["bun", "run", "docker/server.ts"]

# Two stages so the shipped image carries no build toolchain and no source —
# just the runtime, the server, and the compiled frontend.

# ---- build the frontend ----
FROM node:22-slim AS web
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- build the server's native deps (sqlite3, bcrypt) ----
FROM node:22-slim AS api
WORKDIR /build/server
# python3/make/g++ are needed to compile the native modules, and are left behind
# in this stage rather than shipped.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:22-slim
ENV NODE_ENV=production
# Serve the built SPA from the same process: one port, one container to host.
ENV SERVE_STATIC=true
# Keep the database inside the mounted volume, or it dies with the container.
ENV DB_PATH=/app/server/storage/cx_tool.sqlite
WORKDIR /app

# Run as a non-root user: a container process that can't write its own code is
# one less thing an RCE can turn into persistence.
RUN useradd --system --uid 10001 --create-home cx

COPY --from=api   --chown=cx:cx /build/server/node_modules ./server/node_modules
COPY --from=web   --chown=cx:cx /build/dist ./dist
COPY --chown=cx:cx server ./server

# Uploaded documents and the SQLite file live here. Mount a volume over it in
# production, or they vanish with the container.
RUN mkdir -p /app/server/storage && chown -R cx:cx /app/server/storage
VOLUME ["/app/server/storage"]

USER cx
EXPOSE 5000

# The orchestrator restarts the container if this stops answering.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/server.js"]

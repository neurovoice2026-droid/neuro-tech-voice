# syntax=docker/dockerfile:1.7
#
# Voice gateway image. Build context is the REPOSITORY ROOT, because the
# gateway bundles a few dependency-free app modules (wire contracts and the
# localized lines it speaks):
#
#   docker build -f services/voice-gateway/Dockerfile -t ntv-voice-gateway .
#
# BuildKit picks up services/voice-gateway/Dockerfile.dockerignore automatically,
# so only those files and the gateway itself are sent to the builder.

ARG NODE_VERSION=22

# ─── Build: install, typecheck, bundle ────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /repo

# Shared modules (see src/contracts.ts and src/text/phrases.ts).
COPY lib/voice/contracts.ts lib/voice/greetings.ts lib/voice/languages.ts lib/voice/tone.ts lib/voice/
COPY lib/agent-languages.ts lib/
COPY types/index.ts types/

WORKDIR /repo/services/voice-gateway
COPY services/voice-gateway/package.json services/voice-gateway/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY services/voice-gateway/ ./
# Set --build-arg RUN_TESTS=1 to run the offline test suite inside the build.
ARG RUN_TESTS=0
RUN npm run typecheck \
  && if [ "$RUN_TESTS" = "1" ]; then npm test; fi \
  && npm run build

# ─── Runtime: bundle only, non-root ──────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app

# dist/index.js bundles ws and openai; package.json only marks the bundle as ESM.
COPY --from=build --chown=node:node /repo/services/voice-gateway/package.json ./package.json
COPY --from=build --chown=node:node /repo/services/voice-gateway/dist ./dist

USER node
EXPOSE 8080

# /health answers 503 while draining, so orchestrators stop routing new calls.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# SIGTERM starts a graceful drain (up to SHUTDOWN_DRAIN_SECONDS, default 30).
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/index.js"]

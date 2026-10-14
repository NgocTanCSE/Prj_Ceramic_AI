# Test-runner image: runs the verification scripts automatically.
# Image is lean by default (AI+API deps only). Set RUN_FE_BUILD=1 to also install FE
# deps and run `vite build`.
FROM node:22-bookworm-slim

# curl (health probe + real-photo fetch in test_bowl_photo.mjs), ca-certificates (Wikimedia/Common HTTPS)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG RUN_FE_BUILD=0
ENV PORT=8001 HOST=0.0.0.0 NODE_ENV=test

# 1) Install server-side deps (sharp + @imgly/background-removal-node + express).
#    Manifest-only copy → layer cache; sources added afterwards.
COPY AI/package*.json AI/
COPY API/package*.json API/
RUN cd AI && npm install --no-audit --no-fund \
 && cd ../API && npm install --no-audit --no-fund

# 2) FE deps only when an FE production build is requested (keeps default image small).
COPY FE/package*.json FE/
RUN if [ "${RUN_FE_BUILD}" = "1" ]; then cd FE && npm install --no-audit --no-fund; fi

# 3) Copy source (root .dockerignore excludes every node_modules, dist, .git, .env, ...).
COPY . .

COPY docker/test-runner/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Healthcheck: the AI engine health endpoint (API listens on 8001 at runtime).
HEALTHCHECK --interval=15s --timeout=5s --retries=8 --start-period=30s \
  CMD curl -sf http://localhost:8001/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]

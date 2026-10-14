# API & Generative Engine (AI Co-Creator)
#
# IMPORTANT: server.js imports ../AI/auto_clean_pipeline.js and ../AI/potterySuitabilityAnalyzer.js
# (sharp + @imgly/background-removal-node). The AI module lives in the repo-level AI/ dir, so the
# build CONTEXT must be the repo root (see docker-compose.yml: context: .).
FROM node:20-bookworm

WORKDIR /app

# 1) Copy manifests only → leverage layer cache for dependency install.
COPY AI/package*.json AI/
COPY API/package*.json API/

# 2) Install server deps (express/cors/dotenv/sharp) + AI deps (@imgly/background-removal-node).
#    NOTE: sharp is a *devDependency* of AI but a runtime import of the analyzer, so install
#    happens BEFORE setting NODE_ENV=production (otherwise npm drops devDeps and sharp is missing).
RUN cd AI && npm install --no-audit --no-fund \
 && cd ../API && npm install --no-audit --no-fund

# 3) Runtime mode (after dev deps are installed).
ENV NODE_ENV=production

# 4) Copy source (node_modules preserved above; root .dockerignore keeps local ones out).
COPY AI/ AI/
COPY API/ API/
# Sample assets the API reads at runtime (pottery-bowl-004.png, mug-001, vase-001, etc.)
COPY FE/src/data FE/src/data

EXPOSE 8000

CMD ["node", "API/server.js"]

#!/usr/bin/env bash
# Auto-runs the verification scripts for the pottery suitability gate.
#   - starts the AI engine (API) on :8001
#   - waits for /api/health
#   - runs analyzer unit test, smoke (real samples + 6-view normalize),
#     real-photo bowl gate, and (optionally) FE vite build.
#   exits non-zero if any required step fails.
set -uo pipefail
cd /app

log(){ echo "[test-runner] $*"; }

log "starting AI API on :8001 ..."
PORT=8001 node API/server.js & API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

log "waiting for /api/health ..."
READY=0
for i in $(seq 1 120); do
  if curl -sf "http://localhost:8001/api/health" >/dev/null 2>&1; then
    log "API ready"; READY=1; break
  fi
  sleep 1
done
if [ "$READY" != "1" ]; then log "ERROR: API did not become healthy"; exit 1; fi

EXIT=0
# step "label" cmd...
step(){ log "=== STEP: $1 ==="; shift; if "$@"; then log "PASS: $1"; else log "FAIL: $1"; EXIT=1; fi; }

# 3) analyzer unit test (no network)
step "analyzer-classifier" node tools/test_analyzer_classifier.mjs

# 4) smoke: 3 real samples -> suitable, 6x750 views, right!=back
step "smoke-phases1to3" node tools/smoke_phases1to3.mjs

# 5) real-photo bowl gate (needs internet; WARN+skip if it can't fetch a photo)
step "bowl-real-photo" node tools/test_bowl_photo.mjs

# 6) optional FE production build
if [ "${RUN_FE_BUILD:-0}" = "1" ]; then
  step "fe-vite-build" sh -c 'cd FE && npx vite build'
else
  log "skipping FE vite build (set RUN_FE_BUILD=1 to enable)"
fi

log "DONE exit=$EXIT"
exit $EXIT

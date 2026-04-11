#!/usr/bin/env bash
# Start API server and Expo frontend together from the repo root.
# Usage: ./scripts/start-dev.sh   or   pnpm run dev
#
# Optional env (defaults shown):
#   PORT_API=3001       — Express API (required by api-server)
#   PORT_FRONTEND=8081  — Metro / Expo dev server

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/load-node-env.sh
source "${ROOT}/scripts/load-node-env.sh"

PORT_API="${PORT_API:-3001}"
PORT_FRONTEND="${PORT_FRONTEND:-8081}"

cleanup() {
  local job
  for job in $(jobs -p); do
    kill "$job" 2>/dev/null || true
  done
}

trap cleanup INT TERM EXIT

echo "Starting API on port ${PORT_API} and Expo on port ${PORT_FRONTEND} (Ctrl+C stops both)"

(
  export PORT="$PORT_API"
  pnpm --filter @workspace/api-server run dev
) &

(
  cd "${ROOT}/artifacts/frontend"
  export PORT="$PORT_FRONTEND"
  pnpm exec expo start --localhost --port "$PORT_FRONTEND"
) &

wait

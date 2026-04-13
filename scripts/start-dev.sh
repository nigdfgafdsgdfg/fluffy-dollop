#!/usr/bin/env bash
# Start API server and Expo frontend together from the repo root.
# Usage: ./scripts/start-dev.sh   or   pnpm run dev
#
# Optional env (defaults shown):
#   PORT_API=3001       — Express API (required by api-server)
#   PORT_FRONTEND=8081  — Metro / Expo dev server
#   EXPO_DEV_HOST=lan   — Expo connection: lan | tunnel | localhost
#                         (default lan: phone on same Wi‑Fi; tunnel uses ngrok and often fails behind VPN/firewall)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/load-node-env.sh
source "${ROOT}/scripts/load-node-env.sh"

if [ -f "${ROOT}/.env" ]; then
  set -a
  source "${ROOT}/.env"
  set +a
fi

PORT_API="${PORT_API:-3001}"
PORT_FRONTEND="${PORT_FRONTEND:-8081}"
EXPO_DEV_HOST="${EXPO_DEV_HOST:-lan}"

case "$EXPO_DEV_HOST" in
  tunnel)
    expo_host_flag="--tunnel"
    expo_host_note="tunnel (ngrok)"
    ;;
  localhost)
    expo_host_flag="--localhost"
    expo_host_note="localhost (simulator / this machine only)"
    ;;
  lan|*)
    expo_host_flag="--lan"
    expo_host_note="LAN — open Expo Go on the same Wi‑Fi as this computer"
    ;;
esac

cleanup() {
  local job
  for job in $(jobs -p); do
    kill "$job" 2>/dev/null || true
  done
}

trap cleanup INT TERM EXIT

echo "Starting API on port ${PORT_API} and Expo on port ${PORT_FRONTEND} (${expo_host_note}; Ctrl+C stops both)"

(
  export PORT="$PORT_API"
  pnpm --filter @workspace/api-server run dev
) &

(
  cd "${ROOT}/artifacts/frontend"
  export PORT="$PORT_FRONTEND"
  unset REACT_NATIVE_PACKAGER_HOSTNAME
  unset EXPO_PACKAGER_PROXY_URL
  unset EXPO_PUBLIC_DOMAIN
  unset EXPO_PUBLIC_REPL_ID
  pnpm exec expo start "$expo_host_flag" --port "$PORT_FRONTEND" --clear
) &

wait

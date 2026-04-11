#!/usr/bin/env bash
# Run pnpm with nvm/fnm loaded (works when plain `pnpm` is missing in zsh).
# Usage: bash scripts/pnpm.sh install
#        bash scripts/pnpm.sh run dev

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/load-node-env.sh
source "${ROOT}/scripts/load-node-env.sh"

if ! command -v node &>/dev/null; then
  echo "Node.js not found. Install Node 24+ or fix nvm in ~/.zshrc, then retry."
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "pnpm not found for this Node. Run once: bash scripts/enable-pnpm.sh"
  exit 1
fi

exec pnpm "$@"

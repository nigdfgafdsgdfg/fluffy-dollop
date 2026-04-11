#!/usr/bin/env bash
# One-time (or per-machine) setup: make `pnpm` available for this project.
# Run from anywhere: bash scripts/enable-pnpm.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/load-node-env.sh
source "${ROOT}/scripts/load-node-env.sh"

if ! command -v node &>/dev/null; then
  echo "Node.js was not found in PATH."
  echo "Install Node 24+ (https://nodejs.org) or Homebrew: brew install node"
  echo "If you use nvm, run: nvm install 24 && nvm use 24"
  echo "Then run this script again."
  exit 1
fi

echo "Using Node $(node --version) at $(command -v node)"

if ! command -v corepack &>/dev/null; then
  echo "corepack is missing (it ships with Node). Upgrade Node to 16.13+ or a current LTS."
  exit 1
fi

corepack enable
corepack prepare pnpm@latest --activate

echo "pnpm $(pnpm --version) is ready for this Node install ($(command -v node))."
echo ""
echo "If your terminal still says 'pnpm: command not found', zsh is not loading nvm,"
echo "so Node's bin dir is not on PATH. Use the wrappers (they load nvm for you):"
echo "  bash scripts/pnpm.sh install"
echo "  bash scripts/start-dev.sh"
echo ""
echo "Permanent fix: add nvm to ~/.zshrc — see https://github.com/nvm-sh/nvm#installing-and-updating"
echo "Or install pnpm globally on PATH: brew install pnpm"

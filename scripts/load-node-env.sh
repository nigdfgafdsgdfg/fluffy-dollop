#!/usr/bin/env bash
# Put the same Node/nvm/fnm + Homebrew paths on PATH as in a login shell.
# Intended to be sourced from other scripts in this repo:
#   source "${ROOT}/scripts/load-node-env.sh"

if [[ -z "${NODE_SKIP_NVM:-}" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    if nvm ls &>/dev/null; then
      nvm use 24 2>/dev/null || nvm use default 2>/dev/null || true
    fi
  fi
fi

if command -v fnm &>/dev/null; then
  eval "$(fnm env)"
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

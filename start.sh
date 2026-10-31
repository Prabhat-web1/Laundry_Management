#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20.9 or newer is required." >&2
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)'; then
  echo "Error: Node.js 20.9 or newer is required. Found $(node --version)." >&2
  exit 1
fi

PNPM_CMD=(pnpm)
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    PNPM_CMD=(corepack pnpm)
  else
    echo "Error: pnpm is required. Install pnpm or enable Corepack, then run this script again." >&2
    exit 1
  fi
fi

if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    echo "Error: .env.example is missing; cannot configure the local database." >&2
    exit 1
  fi
  cp .env.example .env
  echo "Created .env from .env.example."
fi

if [[ ! -x node_modules/.bin/next ]]; then
  echo "Installing project dependencies…"
  "${PNPM_CMD[@]}" install --frozen-lockfile
fi

echo "Preparing the local database…"
"${PNPM_CMD[@]}" db:push
"${PNPM_CMD[@]}" db:seed

echo "Starting Washday at http://localhost:3000"
exec "${PNPM_CMD[@]}" dev

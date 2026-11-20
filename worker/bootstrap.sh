#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$HOME/.mersal-converter-bootstrap.lock"
exec 9>"$LOCK"
flock -n 9 || exit 0

if ! command -v soffice >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y --no-install-recommends libreoffice-writer python3-venv python3-pip curl
fi

if [ ! -x "$ROOT/worker/.venv/bin/python" ]; then
  python3 -m venv "$ROOT/worker/.venv"
fi

if [ ! -f "$ROOT/worker/.venv/.mersal-dependencies-ready" ]; then
  "$ROOT/worker/.venv/bin/pip" install --disable-pip-version-check --no-cache-dir -r "$ROOT/worker/requirements.txt"
  touch "$ROOT/worker/.venv/.mersal-dependencies-ready"
fi

if [ ! -f "$ROOT/worker/node_modules/@vercel/blob/package.json" ]; then
  npm --prefix "$ROOT/worker" install --omit=dev --no-audit --no-fund
fi

nohup node "$ROOT/worker/server.mjs" > "$HOME/mersal-converter-server.log" 2>&1 </dev/null &

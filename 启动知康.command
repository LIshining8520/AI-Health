#!/bin/zsh
set -e
cd "${0:A:h}"
if [[ ! -x backend/.venv/bin/python || ! -d frontend/node_modules ]]; then
  echo '请先按 README.md 完成依赖安装。'
  exit 1
fi
if lsof -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1 || lsof -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo '8000 或 5173 端口已被使用。若知康已启动，请访问 http://127.0.0.1:5173 。'
  exit 1
fi
backend/.venv/bin/python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 &
backend_pid=$!
trap 'kill $backend_pid 2>/dev/null || true' EXIT INT TERM
cd frontend
npm run dev

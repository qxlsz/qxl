#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-mlx-community/Qwen2.5-Coder-7B-Instruct-4bit}"
PORT="${2:-8080}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Starting mlx_lm.server"
echo "  Model: $MODEL"
echo "  Port:  $PORT"
echo "  Venv:  $REPO_ROOT/.venv"
echo ""

source "$REPO_ROOT/.venv/bin/activate"
python3 -m mlx_lm.server \
  --model "$MODEL" \
  --port "$PORT" \
  --host 127.0.0.1 \
  --log-level INFO

# qxl

**local-first agentic coding CLI — runs entirely offline on Apple Silicon via MLX**

qxl is a privacy-preserving, fully offline coding agent that runs powerful language models directly on your machine using Apple's MLX framework. No cloud calls, no telemetry, no API keys — just your code and local hardware. It ships a reactive terminal UI built with Ink/React, an agent loop with file tools, and persistent sessions via SQLite.

---

## Why

- **Private** — your code never leaves your machine
- **Offline** — no internet required after model download
- **Uncensored** — optional research mode via Gemma-4-E4B-OBLITERATED
- **Fast** — Apple Silicon unified memory makes 35B MoE models viable at ~3B active params

---

## Prerequisites

- Apple Silicon Mac (M1 or later)
- [Bun](https://bun.sh) 1.3.12+
- Python 3.12 via [uv](https://github.com/astral-sh/uv) (for the MLX server)
- `mlx_lm` installed in a `.venv` at the repo root

```bash
uv venv --python 3.12 .venv
source .venv/bin/activate
pip install mlx-lm
```

---

## Quick start

```bash
# Install dependencies
bun install

# Just run qxl — it starts the model server automatically
bun run dev
# or with the compiled binary:
./dist/qxl

# With a direct prompt (skips interactive input):
bun run dev "refactor this to use async/await"

# Skip the model picker (if you know which model you want):
bun run dev --model "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit" "explain this code"
```

> **Note:** qxl automatically spawns, manages, and stops the `mlx_lm.server` process. No separate server step needed.

---

## Models

| Role | Model | Notes |
|------|-------|-------|
| Coding (default) | `mlx-community/Qwen3.6-35B-A3B-4bit-DWQ` | 35B MoE, ~3B active, 262K ctx |
| Fast | `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` | lighter, faster |
| Research | `Gemma-4-E4B-OBLITERATED` | uncensored research mode |

The MLX server exposes an OpenAI-compatible API on port 8090 by default.

### Configuration

Override via environment variables:

```bash
QXL_BASE_URL=http://127.0.0.1:8090/v1
QXL_MODEL=mlx-community/Qwen3.6-35B-A3B-4bit-DWQ
QXL_PYTHON=/path/to/python3.12   # use a specific Python if not using .venv/
```

Or via `.qxl/settings.json` in your workspace:

```json
{
  "baseURL": "http://127.0.0.1:8090/v1",
  "router": {
    "roles": {
      "coding": "mlx-community/Qwen3.6-35B-A3B-4bit-DWQ",
      "fast": "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit"
    }
  }
}
```

---

## Workspace

Bun workspaces monorepo under `packages/`:

| Package | Description |
|---------|-------------|
| `@qxl/gateway` | OpenAI-compatible client, streaming, tool calling |
| `@qxl/tools` | File tools: Read, Write, Edit, Glob, Grep |
| `@qxl/core` | Agent loop, session management (bun:sqlite) |
| `@qxl/tui` | Ink 5 React terminal UI |
| `@qxl/cli` | commander CLI entry point (`qxl` binary) |
| `@qxl/spike` | MLX server integration spike (archived) |

---

## Development

```bash
bun install        # install all workspace deps
bun run dev        # run the CLI in dev mode
bun test           # run tests across all packages
bun run build      # build standalone binary to dist/qxl
```

---

## Roadmap

| Milestone | Status | Scope |
|-----------|--------|-------|
| M0 — MLX spike | Done | Streaming + tool calling validated against mlx_lm.server |
| M1 — Core harness | Done | Agent loop, file tools (Read/Write/Edit/MultiEdit/Glob/Grep), sessions, config, memory, TUI, CLI |
| M2 — Hooks & permissions | Planned | Pre/post-tool hooks, allow/deny rules |
| M3 — MCP | Planned | Model Context Protocol server support |
| M4 — Research mode | Planned | Gemma-4-E4B-OBLITERATED integration |
| M5 — Eval | Planned | Automated benchmarks and regression suite |
| M6 — Distribution | Planned | Single binary, Homebrew tap |

---

## Repo

[github.com/qxlsz/qxl](https://github.com/qxlsz/qxl)

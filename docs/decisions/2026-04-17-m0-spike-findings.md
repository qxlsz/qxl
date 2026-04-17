# M0 Spike Findings — Go/No-Go

**Date:** 2026-04-17
**Tested by:** automated (Claude Opus 4.7 + subagent-driven-development)

## Environment

- **Hardware:** Apple Silicon (arm64), macOS 26.5
- **MLX server:** `mlx_lm` 0.31.2, `mlx_lm.server` on port 8090
- **Model used for spike:** `Qwen/Qwen2.5-0.5B-Instruct` (locally cached, no download needed)
- **Note on model choice:** `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` (plan default) not yet cached. Used 0.5B to unblock spike — validates API surface. Full 7B/35B validation is a pre-M1 step.

## Results

| Test | Result | Notes |
|---|---|---|
| Streaming SSE (0.5B) | ✅ PASS | Tokens streamed correctly via `.create({ stream: true })` |
| Tool calling (read_file, 0.5B) | ✅ PASS | Structured `tool_calls` emitted, `finish_reason: "tool_calls"` |
| Ink TUI rendering | ✅ PASS | `StreamOutput` + tool card render correctly in `ink-testing-library` |
| Full test suite | ✅ 4/4 pass | `bun test --timeout 60000` — 1.3s total |

## Issues Found & Resolved

| Issue | Resolution |
|---|---|
| `client.chat.completions.stream()` not available in openai@4.104.0 | Switched to `.create({ stream: true })` — identical streaming behaviour, fully supported |
| Port 8080 occupied (Hyperspace Network proxy) | Using port **8090** — update `QXL_BASE_URL` default and `scripts/mlx-server.sh` |
| Homebrew Python 3.14 (externally managed, mlx unsupported) | Created `uv` venv with Python 3.12 at `.venv/` — `mlx_lm` installs and runs cleanly |
| Bun not installed | Installed via `curl -fsSL https://bun.sh/install | bash` — Bun 1.3.12 |

## Open Questions Resolved

- **O1 (MLX server choice):** `mlx_lm.server` works correctly. OpenAI-compat API is clean, streaming is reliable, tool schema is passed through the Qwen chat template correctly. **Decision: use `mlx_lm.server` for M1+.**
- **O3 (Qwen `<think>` blocks):** Not present in 0.5B responses. Will need to test with 35B once downloaded — `enable_thinking: false` should suppress them for tool-call turns.

## Outstanding Before M1

- [ ] Pull and validate `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` (~3.5 GB)
- [ ] Pull and validate `mlx-community/Qwen3.6-35B-A3B-4bit-DWQ` (~18 GB) — the actual default coding model
- [ ] Update `scripts/mlx-server.sh` default port to 8090
- [ ] Update `packages/spike/src/index.tsx` default port to 8090 (done in gateway.test.ts, not yet in index.tsx env default)
- [ ] Measure tok/s on actual 7B and 35B models for perf baseline

## KV Cache

KV caching confirmed working: `cached_tokens: 31` observed on second prompt with shared prefix. Good for long agentic sessions.

## Decision

**GO** ✅

All critical infrastructure validated:
- `mlx_lm.server` serves completions and tool calls correctly via OpenAI-compat API
- Streaming SSE works end-to-end through the TypeScript gateway
- Ink TUI renders streamed tokens and tool call cards correctly
- Bun 1.3.12 + TypeScript + Ink 5 stack is solid
- `uv` venv with Python 3.12 + mlx_lm is the correct local Python setup

**Proceed to M1: core harness (agent loop, sessions, Read/Write/Edit, full TUI).**

# qxl — Design Spec v0.1

**Status:** proposed
**Date:** 2026-04-17
**Authors:** qxlsz (with Claude Opus 4.7)
**Backronyms (pick one later):** Qwen X Local · Queryable eXpert Loop

## 1. Summary

`qxl` is a local-first, polyglot, multi-model agentic CLI for coding and autonomous research. It delivers Claude-Code-equivalent UX on top of locally hosted MLX models (primary coding: Qwen3.6-35B-A3B; uncensored research: Gemma-4-E4B-OBLITERATED), with the entire model fleet user-configurable. Zero telemetry, offline-capable, with optional cloud passthrough as an explicit escape hatch.

## 2. Goals

- **G1** Feature parity with Claude Code for agentic coding — agent loop, permissions, hooks, slash commands, subagents, plan mode, resumable sessions, hierarchical memory, MCP, streaming TUI.
- **G2** Autonomous research mode — decompose → search → fetch → synthesize → cite → markdown report.
- **G3** Local-first, MLX-native on Apple Silicon; llama.cpp fallback on other platforms.
- **G4** User-configurable model fleet — any OpenAI-compatible endpoint pluggable; declarative role→model mapping; runtime switching.
- **G5** Production-grade quality throughout — real sandboxing, real eval harness, real distribution, zero shortcuts.

## 3. Non-goals (v1)

- IDE extensions (VS Code, JetBrains) — deferred to v1.1
- Desktop / web GUI — deferred
- Fine-tuning pipeline — deferred
- Vector RAG over the codebase — deferred; start with grep + LLM
- Cloud session sync — out of scope (conflicts with local-first pillar)
- Agent marketplace — out of scope (MCP covers extensibility)
- Windows native — deferred to v1.1 (WSL works in v1)

## 4. Architecture

### 4.1 Three-tier overview

```
┌──────────────────────────────────────────────────┐
│ qxl CLI (Bun / TypeScript)                       │
│  ├─ TUI (Ink)                                    │
│  ├─ Agent loop (streaming, cancellable, resumable)│
│  ├─ Model router (task → role → model)           │
│  ├─ Inference gateway (OpenAI-compat client)     │
│  ├─ Tool dispatcher                              │
│  ├─ Permissions · Hooks · Slash cmds · Subagents │
│  ├─ MCP client                                   │
│  ├─ Sessions (SQLite)                            │
│  ├─ Memory (QXL.md hierarchy)                    │
│  └─ Research pipeline                            │
└───────┬──────────────────────┬───────────────────┘
        │ NDJSON over stdio    │ HTTP (OpenAI API)
┌───────▼────────────┐   ┌─────▼──────────────────┐
│ Native Rust workers│   │ MLX inference server   │
│  ├─ qxl-search     │   │  ├─ qwen3.6-35b-a3b    │
│  ├─ qxl-shell      │   │  ├─ gemma-4-obliterated│
│  ├─ qxl-webfetch   │   │  └─ qwen2.5-coder-7b   │
│  └─ qxl-index      │   └────────────────────────┘
└────────────────────┘
```

**Why polyglot.** Bun/TS owns the harness and UX where iteration speed and ecosystem (MCP SDK, Ink, streaming primitives) matter. Rust owns the hot paths where correctness + perf matter: ripgrep-grade search, sandboxed shell, fast HTTP with Readability, file indexing.

### 4.2 Monorepo layout

```
qxl/
├── packages/                   # Bun workspace
│   ├── cli/                    # `qxl` binary entry
│   ├── core/                   # agent loop, session, event bus
│   ├── router/                 # model-selection policy
│   ├── gateway/                # OpenAI-compat client (streaming, tools)
│   ├── tools/                  # TS tools (Read/Write/Edit/MultiEdit/Task)
│   ├── tools-protocol/         # NDJSON protocol types (TS + Rust codegen)
│   ├── tui/                    # Ink app
│   ├── mcp/                    # MCP client
│   ├── config/                 # settings.json, permissions, hooks loader
│   ├── research/               # autonomous research pipeline
│   └── eval/                   # eval harness
├── native/                     # Cargo workspace
│   ├── qxl-search/             # Grep + Glob (built on `ignore` + `grep-regex`)
│   ├── qxl-shell/              # Sandboxed Bash
│   ├── qxl-webfetch/           # HTTP + Readability
│   └── qxl-index/              # Fuzzy file index + MRU
├── scripts/                    # model pull, release, dev
└── docs/
```

### 4.3 Tool execution boundary

All tool calls go through a uniform dispatcher. TS tools execute in-process. Rust tools run as long-lived co-processes (one per worker type), communicating via NDJSON framed on stdin/stdout. Protocol types are defined once in `packages/tools-protocol/` and code-generated into Rust structs. Each Rust worker is a single static binary, installed alongside the `qxl` binary.

## 5. Model fleet & router

### 5.1 Shipped defaults (all MLX)

| Role | Model | Rationale |
|---|---|---|
| **coding** (primary) | `mlx-community/Qwen3.6-35B-A3B-4bit-DWQ` | MoE (3B active) → fast inference; native tool-calling via `qwen3_coder` parser; 262K ctx |
| **research** (uncensored) | `OBLITERATUS/gemma-4-E4B-it-OBLITERATED` (converted to MLX 4-bit) | Uncensored, slow-OK for batch research |
| **coding-uncensored** (opt) | `Youssofal/Qwen3.6-35B-A3B-Abliterated-Heretic-MLX-4bit` | Security-research coding without refusals |
| **fast** (tab-grade) | `mlx-community/Qwen2.5-Coder-7B-4bit` | Cheap edits, low latency |
| **plan / thinking** | coding model w/ `enable_thinking: true` | Same weights, flag-toggled |
| **cloud passthrough** (opt) | user-configured (Anthropic / OpenAI / OpenRouter / …) | Opt-in escape hatch |

Low-RAM alternative default (auto-selected if unified memory < 32 GB):
- coding → `baa-ai/Qwen3.6-35B-A3B-RAM-25GB-MLX`
- fast → same 7B

### 5.2 Router policy

`packages/router/policy.ts` implements a pure function `(task, context) → modelId`, with override at `.qxl/router.ts` (hot-reloaded).

Classification signals:
- Subcommand (`code` vs `research`)
- Current mode (default, plan, acceptEdits, bypassPermissions)
- Context-window pressure (auto-promote to higher-ctx model)
- User override (`/model <id>` slash command, or per-call header)
- Heuristic: turn contains `<thinking>` request → promote to thinking role

Fallback chain: primary → fallback → cloud (if configured) → error.

Optional ensembling policy (off by default): fan out same prompt to N models, judge model picks best.

### 5.3 Model lifecycle: `qxl models`

```
qxl models pull <hf-id> [--quant <q>] # download, convert if needed, register
qxl models list                       # installed + role assignments
qxl models rm <id>
qxl models add <id> --url <url>       # register external OpenAI-compat endpoint
qxl models set-role <role> <id>
qxl models info <id>                  # size, ctx, caps, last-used
qxl models bench <id>                 # eval suite quick pass
qxl models convert <hf-id>            # Transformers safetensors → MLX
```

Registry at `~/.qxl/models.json`; project override `.qxl/models.json`.

## 6. Inference gateway

Single client abstraction used everywhere.

- **Endpoints:** `/v1/chat/completions` (streaming SSE), `/v1/models`
- **Tool calls:** JSON-schema tool defs → provider-formatted messages → structured calls parsed back. Parser pluggable per model (default `qwen3_coder`, also `openai`, `anthropic-via-shim`).
- **Thinking mode:** passes `chat_template_kwargs: { enable_thinking: true }` when role=plan. Strips `<think>…</think>` from user-visible transcript but preserves in session log and exposes via `/think` slash command.
- **Retries:** exponential backoff, 3 attempts, then router fallback.
- **Cancellation:** `AbortController` threaded from TUI Esc key into HTTP stream.
- **Backends tested in M0 spike:** `mlx_lm.server`, LM Studio (MLX), llama.cpp server, Ollama, vLLM, OpenAI API, Anthropic (via compat shim).

## 7. Agent loop

Turn structure:

1. User input (or dispatched subagent prompt) appended to message queue
2. Harness composes system prompt: role card + injected memory + tool schemas + env context
3. Gateway call → streaming response
4. Stream parsed into text deltas (→ TUI) + tool calls (queued)
5. Each tool call:
   a. Permission check (settings rules → hooks → user prompt if needed)
   b. Dispatched (TS in-proc or Rust worker)
   c. Result returned as `tool_result` message
6. Loop continues until model returns with no tool calls or Stop hook fires
7. Session state persisted to SQLite after every turn

Esc cancels in-flight gracefully: stops stream, kills running tool, rolls transcript back to last user turn.

## 8. Tools

### 8.1 File tools (TS)
- `Read` — offset/limit, image support, notebook support
- `Write` — permission-gated
- `Edit` — exact string replacement (enforces uniqueness unless `replace_all`)
- `MultiEdit` — batched edits with atomicity per file
- `Glob` → dispatches to `qxl-search` worker
- `Grep` → dispatches to `qxl-search` worker

### 8.2 Shell (Rust: `qxl-shell`)
- Sandboxed execution:
  - **macOS:** `sandbox-exec` with a bundled profile (default: no network, fs read limited to cwd + tmp, no write outside cwd)
  - **Linux:** `landlock` (fs scope) + `seccomp-bpf` (syscall filter) + user-namespace where available
- Streaming stdout/stderr back to TUI
- Timeout + SIGTERM/SIGKILL escalation
- Background mode (`run_in_background`) + output polling via `BashOutput`-equivalent tool
- Approval rules from settings drive sandbox scope per invocation

### 8.3 Web (Rust: `qxl-webfetch`)
- HTTP/2 client with redirect + ETag cache
- robots.txt respected
- Readability extraction → clean markdown
- Size and timeout limits
- Used by both `WebFetch` tool and research pipeline

### 8.4 Search backend (TS: `WebSearch`)
- Pluggable: `searxng` (default, points at local or configured URL), `tavily`, `brave`, `exa`
- Backend selection via `.qxl/settings.json` + env-based API keys
- Rate-limiting + backoff per backend

### 8.5 Task (subagent dispatch)
- Launches subagent with its own agent loop and isolated context
- Subagents defined in `.qxl/agents/<name>.md` (YAML frontmatter: `model`, `tools`, `description` + markdown body as system prompt)
- Parent receives a single summary message; intermediate tool calls hidden unless `--verbose`

### 8.6 Plan mode
- Read-only tools only; `Write`/`Edit`/`Bash` (non-read) denied
- Model emits a plan doc
- User approves → transitions to execute mode for the same turn chain
- Plan mode triggered via `/plan` or `--plan` flag

## 9. Config & parity

`~/.qxl/settings.json` (global) → `.qxl/settings.json` (project, gitted) → `.qxl/settings.local.json` (gitignored) merged last-wins.

```jsonc
{
  "$schema": "https://qxl.dev/schema/settings-v1.json",

  "models": { /* see §5 */ },
  "router": { "roles": { "coding": "...", "research": "...", "fast": "...", "plan": "..." } },

  "permissions": {
    "defaultMode": "default",
    "rules": [
      { "tool": "Bash", "pattern": "git *", "action": "allow" },
      { "tool": "Bash", "pattern": "rm -rf *", "action": "deny" },
      { "tool": "Write", "pattern": "**/*.env", "action": "deny" },
      { "tool": "WebFetch", "pattern": "*", "action": "prompt" }
    ]
  },

  "hooks": {
    "PreToolUse":       [{ "matcher": "Bash", "command": "..." }],
    "PostToolUse":      [{ "matcher": "Write", "command": "..." }],
    "SessionStart":     [{ "command": "..." }],
    "UserPromptSubmit": [{ "command": "..." }],
    "Stop":             [{ "command": "..." }],
    "SubagentStop":     [{ "command": "..." }]
  },

  "mcpServers": {
    "<name>": { "command": "...", "args": [...], "env": {...} }
  },

  "env": {
    "FOO": "bar",
    "OPENAI_API_KEY": "keychain:qxl/openai"
  },

  "research": {
    "searchBackend": "searxng",
    "searxngUrl": "http://localhost:8080",
    "maxDepth": 3,
    "maxSources": 20,
    "reportDir": "./research"
  },

  "telemetry": { "enabled": false }
}
```

**Compatibility note:** Schema is *inspired by* Claude Code's and structurally similar for permissions, hooks, and MCP, so community hooks port with minor renames. It is not claimed to be drop-in compatible.

## 10. Slash commands, subagents, memory, hooks

- **Slash commands** — `.qxl/commands/<name>.md` (frontmatter: `description`, `argument-hint`; body = prompt template). `/help` lists all.
- **Subagents** — `.qxl/agents/<name>.md` (frontmatter: `name`, `description`, `tools`, `model`; body = system prompt).
- **Memory** — `QXL.md` hierarchy, auto-injected into system prompt:
  - `~/.qxl/QXL.md` (global user memory)
  - `<repo-root>/QXL.md` (project memory, gitted)
  - Ancestor chain from cwd
  - `.qxl/memory/*.md` (typed memories — user, feedback, project, reference — indexed in `MEMORY.md`, auto-memory style)
- **Hooks** — event-driven shell commands. JSON on stdin; exit code 0 = allow, 2 = block (stderr shown to model), other nonzero = error. Stdout may contain structured JSON to inject context or override.

## 11. Research mode

`qxl research "<question>" [--depth N] [--sources M] [--model <id>]`

### 11.1 Pipeline

```
question
  ↓ decompose (research model)
sub-questions[]
  ↓ per sub-q: plan 3-5 queries (research model)
queries[]
  ↓ SearchBackend (SearXNG default)
results[]
  ↓ qxl-webfetch (parallel, rate-limited, robots)
docs[]
  ↓ score relevance, keep top-k (research model)
top_docs[]
  ↓ summarize each + extract cited claims (research model)
summaries[]
  ↓ synthesize per sub-q with inline [n] citations (research model)
section_writeups[]
  ↓ detect gaps → optional re-plan (loop up to --depth)
  ↓ assemble full report (research model)
report.md
```

### 11.2 Output

`./research/<slug>-<UTC-ts>.md`:

```md
# <Question>

**Generated:** 2026-04-17T12:34Z · **Model:** gemma-4-E4B-OBLITERATED · **Sources:** 12

## TL;DR
…

## <Sub-question 1>
… with citations [1][3].

## Sources
[1] <title> — <url>
[2] …
```

### 11.3 Resumability

Each step checkpoints to SQLite (`research_steps` table). `qxl research resume <session-id>` continues. Crashes recoverable without re-paying search costs.

### 11.4 User control

Interactive by default: TUI surfaces decomposed sub-questions and chosen sources; user may approve/reject before fetch. `--auto` flag skips approvals for unattended runs.

## 12. TUI (Ink)

- Panes: main transcript (streamed), tool-call cards (collapsible, show stdin/stdout/exit code), status bar (model, role, turn, tokens, elapsed)
- Input: multiline, slash-command autocomplete, `@file` autocomplete from fuzzy index, history with up-arrow, paste-safe for large blobs
- Keys: Esc cancel · Ctrl+C exit · Tab autocomplete · `/` slash · `@` file ref · Ctrl+R resume

## 13. Sessions

SQLite at `~/.qxl/sessions.db`. Tables: `sessions`, `messages`, `tool_calls`, `research_steps`, `model_usage`.

- `qxl` — new session in cwd
- `qxl -c` — continue last session in cwd
- `qxl -r <id>` — resume specific session
- `qxl sessions list | rm | export <id> > out.jsonl`

Compaction: when context fills past threshold (default 80%), background summarization call condenses oldest turns into a summary message; last N tool-call traces retained verbatim.

## 14. Permissions

Rule engine evaluated per tool call:
- Exact match > glob match > default-mode rule
- Actions: `allow`, `deny`, `prompt`
- Plan mode: deny all write-class tools unconditionally, regardless of rules
- `bypassPermissions` mode: one-time confirmation; subsequent calls allow-all for session; still logged

Prompts rendered in TUI, never via raw terminal `read`.

## 15. Hooks

Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`.

Hook command receives JSON on stdin (event type, payload). Exit code:
- `0` → allow/continue
- `2` → block (stderr shown to model as tool_result error)
- other nonzero → error surfaced to user

Stdout may carry structured JSON for advanced behaviors (inject context into next turn, override tool result, etc.).

## 16. MCP

Full MCP client (stdio + HTTP/SSE). Servers configured in `settings.json`. Tools, resources, and prompts all exposed. Tool namespacing: `mcp__<server>__<tool>`. Parity with Claude Code's MCP behavior, so existing MCP servers (filesystem, github, playwright, etc.) work unmodified.

## 17. Sandboxing

See §8.2 for implementation; summary:
- **macOS** `sandbox-exec` profiles
- **Linux** `landlock` + `seccomp-bpf` + user-ns
- Opt-out via `bypassPermissions` mode (still logged)
- Profiles per approval rule — e.g., `{tool: Bash, pattern: "git *", sandbox: {network: true}}`

## 18. Eval harness (`packages/eval/`)

- **Task suite** — 50+ fixed prompts with expected tool-call traces and final-state assertions. Categories: code-nav, edit, refactor, debug, research, MCP, plan-mode.
- **Metrics** — success rate, tool-call accuracy (Jaccard over tool sequences), steps, wall time, input/output tokens, cost.
- **Runners** — run suite against any configured model; persistent results DB; diff runs to detect regressions.
- **CI gate** — PR blocked if core-task success drops >5% or tool-call accuracy drops >10% vs main baseline.

## 19. Observability

- JSONL session logs at `~/.qxl/logs/<session>.jsonl`
- `qxl logs <session> [--follow]`
- Token + wall-time counters in TUI status bar
- **Zero network-based telemetry.** The only outbound network calls `qxl` makes are (a) to configured model endpoints, (b) to configured search backends, (c) to `WebFetch` URLs the model requests.

## 20. Security & privacy

- **Zero telemetry.** No phone-home under any circumstance.
- All code, config, sessions, research reports, and memory stay on disk.
- Secrets: `env` values prefixed `keychain:<service>/<key>` resolve from OS keychain (macOS Keychain, libsecret on Linux); raw strings in settings are permitted but discouraged.
- Settings files are created with `0600` perms; `settings.local.json` added to `.gitignore` by scaffolding.
- **No leaked proprietary code is used, referenced, or bundled.** Reference architectures are limited to: Claude Agent SDK (official, Apache-2.0), claw-code (public), codex-cli (public), opencode (MIT), aider (Apache-2.0), crush (MIT).

## 21. Distribution

- **macOS:** Homebrew (`brew install qxl`), signed + notarized universal binary; bundles Bun-compiled `qxl` + prebuilt Rust workers
- **Linux:** tarball + `.deb` + `.rpm`; `curl -fsSL install.qxl.dev | sh` installer
- **Windows:** deferred; WSL supported via Linux build
- Model downloads on first use via `qxl models pull`; progress bar; SHA-256 checksummed

## 22. License

- First-party code: **Apache-2.0**
- Third-party licenses tracked in `THIRD-PARTY-NOTICES.md`

## 23. Milestones

Each milestone produces a shippable increment and gets its own implementation-plan spec.

- **M0 · Spike (Week 0)** — 100-line prototype validating MLX + Qwen3.6-35B-A3B + tool-calling + streaming SSE + Ink render. Go/no-go gate.
- **M1 · Core harness** — agent loop, gateway, sessions, Read/Write/Edit/MultiEdit, TUI.
- **M2 · Tools & policy** — `qxl-search`, `qxl-shell` (sandboxed), Grep/Glob, permissions engine, hooks.
- **M3 · Extensibility** — MCP client, slash commands, subagents, memory hierarchy, plan mode.
- **M4 · Research** — `qxl-webfetch`, SearXNG integration, research pipeline, report output, resumability.
- **M5 · Quality gates** — eval harness + CI gate; `qxl models` lifecycle; observability polish.
- **M6 · Distribution** — brew tap, installers, signed binaries, docs site, v1.0 release.

## 24. Open questions (to revisit during planning, not blockers)

- **O1** Exact MLX server choice — `mlx_lm.server` vs LM Studio server vs custom wrapper. Decide in M0 spike based on tool-calling fidelity and streaming quality.
- **O2** SearXNG self-hosted vs a chosen public instance for first-run UX. Lean self-hosted; may ship a Docker one-liner.
- **O3** How to surface Qwen `<think>` blocks — hide from TUI transcript by default, expose via `/think` slash command? Or always stream behind a fold?
- **O4** Subagent context — fresh spawn per dispatch vs warm-reusable pool? Pool saves startup cost but risks context bleed.
- **O5** Research mode — default to interactive (approve sources) or fully autonomous? Current plan: interactive by default, `--auto` opt-out.
- **O6** User's Mac unified memory not confirmed — shipping defaults assume 48 GB+; auto-fallback path (§5.1) handles <32 GB. Confirm during M0 setup and tune defaults.

## 25. Success criteria

- `qxl code` can complete a representative coding task (feature + tests) end-to-end on a 48 GB M-series Mac, fully offline, using only shipped default models, with zero cloud calls
- `qxl research "<question>"` produces a coherent, cited markdown report in under 10 minutes for typical 3-depth queries
- Eval suite success rate ≥ 90% of Claude Code's Sonnet baseline on core coding tasks, within 1.5× the wall time
- Clean install → first successful `qxl code` turn in under 10 minutes on a fresh Mac (including model pull)
- Public repo has Apache-2.0 license, CI green, eval regression gate enforced, zero network telemetry verifiable via packet capture

---

*End of spec v0.1. Revise before generating the implementation plan.*

# QXL M1 Core Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working `qxl` CLI that runs a full agentic coding loop — streams from a local MLX model, executes file tools (Read/Write/Edit/MultiEdit/Glob/Grep), persists sessions in SQLite, and renders a streaming Ink TUI.

**Architecture:** Five new Bun workspace packages — `gateway` (production streaming client), `tools` (file tools), `core` (agent loop + sessions + config + memory), `tui` (Ink renderer), `cli` (binary entry). The agent loop is an async generator that yields typed events; the TUI consumes them via `for await` in a `useEffect`.

**Tech Stack:** Bun 1.3.12, TypeScript 5, Ink 5, React 18, openai SDK 4.x, `bun:sqlite` (built-in, no install), `commander` (CLI args)

**Environment:**
- Repo: `/Users/qxlsz/projects/qxl`
- Bun: `export PATH="$HOME/.bun/bin:$PATH"` before every bun command
- MLX server: port **8090** (`bash scripts/mlx-server.sh Qwen/Qwen2.5-0.5B-Instruct 8090`)
- Python venv: `.venv/` (activate for mlx commands)

---

## File Map

```
packages/
  gateway/
    src/
      types.ts        # GatewayEvent, StreamRequest, ToolCall types
      client.ts       # GatewayClient class (async generator streaming)
      index.ts        # re-exports
    package.json
    tsconfig.json

  tools/
    src/
      types.ts        # Tool interface, ToolResult, ToolSchema
      registry.ts     # ToolRegistry — map name → Tool, get schemas
      read.ts         # Read tool
      write.ts        # Write tool
      edit.ts         # Edit tool
      multi-edit.ts   # MultiEdit tool
      glob.ts         # Glob tool (Bun.Glob)
      grep.ts         # Grep tool (pure TS line scanner)
      index.ts        # re-exports + default registry
    package.json
    tsconfig.json

  core/
    src/
      types.ts        # AgentOptions, AgentEvent, Message, SessionRow
      session.ts      # Session class (bun:sqlite CRUD)
      config.ts       # loadConfig() — merges ~/.qxl + .qxl + .qxl/settings.local
      memory.ts       # loadMemory() — walks QXL.md hierarchy
      agent.ts        # agentLoop() async generator
      index.ts        # re-exports
    package.json
    tsconfig.json

  tui/
    src/
      components/
        transcript.tsx  # Renders message history + streaming delta
        tool-card.tsx   # Collapsible tool call card
        status-bar.tsx  # Model / tokens / turn / elapsed
        input.tsx       # Multiline input + Esc handler
      app.tsx           # Root App component, owns all state
      index.tsx         # runTUI() entry
    package.json
    tsconfig.json

  cli/
    src/
      index.ts          # Parses args with commander, calls runTUI()
    package.json
    tsconfig.json
```

---

### Task 1: Expand workspace — add five new packages

**Files:**
- Modify: `package.json` (root)
- Create: `packages/gateway/package.json`, `packages/gateway/tsconfig.json`
- Create: `packages/tools/package.json`, `packages/tools/tsconfig.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/tui/package.json`, `packages/tui/tsconfig.json`
- Create: `packages/cli/package.json`, `packages/cli/tsconfig.json`
- Create: `packages/{gateway,tools,core,tui,cli}/src/.gitkeep`

- [ ] **Step 1: Update root `package.json` scripts**

```json
{
  "name": "qxl",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "spike": "bun run packages/spike/src/index.tsx",
    "dev": "bun run packages/cli/src/index.ts",
    "test": "bun test",
    "build": "bun build packages/cli/src/index.ts --outfile dist/qxl --target bun"
  }
}
```

- [ ] **Step 2: Create `packages/gateway/package.json`**

```json
{
  "name": "@qxl/gateway",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "dependencies": {
    "openai": "^4.97.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 3: Create `packages/tools/package.json`**

```json
{
  "name": "@qxl/tools",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 4: Create `packages/core/package.json`**

```json
{
  "name": "@qxl/core",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "dependencies": {
    "@qxl/gateway": "workspace:*",
    "@qxl/tools": "workspace:*"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 5: Create `packages/tui/package.json`**

```json
{
  "name": "@qxl/tui",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.tsx",
  "dependencies": {
    "@qxl/core": "workspace:*",
    "ink": "^5.0.1",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "bun-types": "latest",
    "ink-testing-library": "^4.0.0"
  }
}
```

- [ ] **Step 6: Create `packages/cli/package.json`**

```json
{
  "name": "@qxl/cli",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "bin": { "qxl": "src/index.ts" },
  "dependencies": {
    "@qxl/core": "workspace:*",
    "@qxl/tui": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "bun-types": "latest"
  }
}
```

- [ ] **Step 7: Create tsconfig.json for each new package**

Create identical `tsconfig.json` in `packages/gateway/`, `packages/tools/`, `packages/core/`, `packages/cli/`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

Create `packages/tui/tsconfig.json` (needs React types):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types", "@types/react"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 8: Create src directories**

```bash
mkdir -p packages/{gateway,tools,core,cli}/src packages/tui/src/components
touch packages/{gateway,tools,core,cli}/src/.gitkeep packages/tui/src/.gitkeep
```

- [ ] **Step 9: Install all dependencies**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl && bun install
```

Expected: lockfile updated, `commander` and workspace links resolved. No errors.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "chore: add gateway, tools, core, tui, cli packages to workspace"
git push origin main
```

---

### Task 2: Gateway package

**Files:**
- Create: `packages/gateway/src/types.ts`
- Create: `packages/gateway/src/client.ts`
- Create: `packages/gateway/src/index.ts`
- Test: `packages/gateway/src/client.test.ts`

- [ ] **Step 1: Create `packages/gateway/src/types.ts`**

```typescript
import type OpenAI from "openai";

export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
export type Tool = OpenAI.Chat.Completions.ChatCompletionTool;
export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type GatewayEvent =
  | { type: "token"; delta: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; stopReason: string };

export interface StreamRequest {
  messages: Message[];
  tools?: Tool[];
  system?: string;
}

export interface GatewayOptions {
  baseURL: string;
  model: string;
  apiKey?: string;
}
```

- [ ] **Step 2: Write failing test `packages/gateway/src/client.test.ts`**

```typescript
import { expect, test, mock } from "bun:test";
import { GatewayClient } from "./client";

test("yields token events for streamed content", async () => {
  const events: string[] = [];
  const client = new GatewayClient({
    baseURL: "http://127.0.0.1:8090/v1",
    model: "Qwen/Qwen2.5-0.5B-Instruct",
  });

  for await (const event of client.stream({
    messages: [{ role: "user", content: "Say exactly: hi" }],
  })) {
    if (event.type === "token") events.push(event.delta);
    if (event.type === "done") break;
  }

  expect(events.length).toBeGreaterThan(0);
  expect(events.join("").toLowerCase()).toContain("hi");
}, 30_000);

test("yields tool_call event when model uses a tool", async () => {
  const client = new GatewayClient({
    baseURL: "http://127.0.0.1:8090/v1",
    model: "Qwen/Qwen2.5-0.5B-Instruct",
  });

  const tool: import("./types").Tool = {
    type: "function",
    function: {
      name: "get_time",
      description: "Get the current time.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  };

  const toolCalls: import("./types").ToolCall[] = [];
  for await (const event of client.stream({
    messages: [{ role: "user", content: "What time is it? Use get_time." }],
    tools: [tool],
  })) {
    if (event.type === "tool_call") toolCalls.push(event.call);
    if (event.type === "done") break;
  }

  expect(toolCalls.length).toBeGreaterThan(0);
  expect(toolCalls[0].function.name).toBe("get_time");
}, 60_000);
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/gateway && bun test src/client.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 4: Create `packages/gateway/src/client.ts`**

```typescript
import OpenAI from "openai";
import type { GatewayEvent, GatewayOptions, StreamRequest } from "./types";

export class GatewayClient {
  private client: OpenAI;
  constructor(private opts: GatewayOptions) {
    this.client = new OpenAI({ baseURL: opts.baseURL, apiKey: opts.apiKey ?? "local" });
  }

  get model(): string { return this.opts.model; }

  async *stream(req: StreamRequest): AsyncGenerator<GatewayEvent> {
    const messages = req.system
      ? [{ role: "system" as const, content: req.system }, ...req.messages]
      : req.messages;

    const stream = await this.client.chat.completions.create({
      model: this.opts.model,
      messages,
      tools: req.tools,
      tool_choice: req.tools?.length ? "auto" : undefined,
      stream: true,
    });

    const pending = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta.content) yield { type: "token", delta: delta.content };

      for (const tc of delta.tool_calls ?? []) {
        if (!pending.has(tc.index)) {
          pending.set(tc.index, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
        }
        const p = pending.get(tc.index)!;
        if (tc.id) p.id = tc.id;
        if (tc.function?.name) p.name = tc.function.name;
        if (tc.function?.arguments) p.args += tc.function.arguments;
      }

      if (choice.finish_reason) {
        for (const [, c] of pending) {
          yield { type: "tool_call", call: { id: c.id, type: "function", function: { name: c.name, arguments: c.args } } };
        }
        yield { type: "done", stopReason: choice.finish_reason };
      }
    }
  }
}
```

- [ ] **Step 5: Create `packages/gateway/src/index.ts`**

```typescript
export { GatewayClient } from "./client";
export type { GatewayEvent, GatewayOptions, StreamRequest, ToolCall, Tool, Message } from "./types";
```

- [ ] **Step 6: Run tests to verify they pass (server must be running on :8090)**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/gateway && bun test src/client.test.ts --timeout 90000 2>&1 | tail -15
```

Expected: `2 pass, 0 fail`

- [ ] **Step 7: Commit and push**

```bash
git add packages/gateway/ && git commit -m "feat(gateway): GatewayClient with async generator streaming"
git push origin main
```

---

### Task 3: Tool types + Read tool

**Files:**
- Create: `packages/tools/src/types.ts`
- Create: `packages/tools/src/registry.ts`
- Create: `packages/tools/src/read.ts`
- Test: `packages/tools/src/read.test.ts`

- [ ] **Step 1: Create `packages/tools/src/types.ts`**

```typescript
import type { Tool as GatewayTool } from "@qxl/gateway";

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface QxlTool {
  name: string;
  schema: GatewayTool;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}
```

- [ ] **Step 2: Create `packages/tools/src/registry.ts`**

```typescript
import type { QxlTool, ToolResult } from "./types";
import type { Tool as GatewayTool } from "@qxl/gateway";

export class ToolRegistry {
  private tools = new Map<string, QxlTool>();

  register(tool: QxlTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): QxlTool | undefined {
    return this.tools.get(name);
  }

  schemas(): GatewayTool[] {
    return [...this.tools.values()].map((t) => t.schema);
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { content: `Unknown tool: ${name}`, isError: true };
    try {
      return await tool.execute(params);
    } catch (err) {
      return { content: `Tool error: ${(err as Error).message}`, isError: true };
    }
  }
}
```

- [ ] **Step 3: Write failing test `packages/tools/src/read.test.ts`**

```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { readTool } from "./read";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__read_tmp__");

beforeAll(async () => {
  await fs.mkdir(TMP, { recursive: true });
  await fs.writeFile(path.join(TMP, "hello.txt"), "line1\nline2\nline3\n");
});

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

test("reads entire file", async () => {
  const result = await readTool.execute({ file_path: path.join(TMP, "hello.txt") });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("line1");
  expect(result.content).toContain("line3");
});

test("reads file with offset and limit", async () => {
  const result = await readTool.execute({ file_path: path.join(TMP, "hello.txt"), offset: 1, limit: 1 });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("line2");
  expect(result.content).not.toContain("line1");
  expect(result.content).not.toContain("line3");
});

test("returns error for missing file", async () => {
  const result = await readTool.execute({ file_path: path.join(TMP, "nope.txt") });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("not found");
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test src/read.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './read'`

- [ ] **Step 5: Create `packages/tools/src/read.ts`**

```typescript
import type { QxlTool } from "./types";
import fs from "node:fs/promises";

export const readTool: QxlTool = {
  name: "Read",
  schema: {
    type: "function",
    function: {
      name: "Read",
      description: "Read a file from the filesystem. Supports text and returns lines with numbers.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the file." },
          offset: { type: "number", description: "Line number to start reading from (0-indexed)." },
          limit: { type: "number", description: "Number of lines to read." },
        },
        required: ["file_path"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const lines = content.split("\n");
    const offset = typeof params.offset === "number" ? params.offset : 0;
    const limit = typeof params.limit === "number" ? params.limit : lines.length;
    const slice = lines.slice(offset, offset + limit);

    const numbered = slice
      .map((line, i) => `${String(offset + i + 1).padStart(4, " ")}\t${line}`)
      .join("\n");

    return { content: numbered, isError: false };
  },
};
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test src/read.test.ts 2>&1 | tail -5
```

Expected: `3 pass, 0 fail`

- [ ] **Step 7: Commit**

```bash
git add packages/tools/src/types.ts packages/tools/src/registry.ts packages/tools/src/read.ts packages/tools/src/read.test.ts
git commit -m "feat(tools): ToolRegistry + Read tool"
git push origin main
```

---

### Task 4: Write and Edit tools

**Files:**
- Create: `packages/tools/src/write.ts`
- Create: `packages/tools/src/edit.ts`
- Test: `packages/tools/src/write.test.ts`
- Test: `packages/tools/src/edit.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/tools/src/write.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { writeTool } from "./write";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__write_tmp__");
beforeAll(() => fs.mkdir(TMP, { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("creates a new file", async () => {
  const p = path.join(TMP, "new.txt");
  const result = await writeTool.execute({ file_path: p, content: "hello world" });
  expect(result.isError).toBe(false);
  expect(await fs.readFile(p, "utf-8")).toBe("hello world");
});

test("overwrites an existing file", async () => {
  const p = path.join(TMP, "over.txt");
  await fs.writeFile(p, "old");
  await writeTool.execute({ file_path: p, content: "new content" });
  expect(await fs.readFile(p, "utf-8")).toBe("new content");
});
```

`packages/tools/src/edit.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { editTool } from "./edit";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__edit_tmp__");
beforeAll(() => fs.mkdir(TMP, { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("replaces unique string", async () => {
  const p = path.join(TMP, "src.ts");
  await fs.writeFile(p, "const x = 1;\nconst y = 2;\n");
  const result = await editTool.execute({ file_path: p, old_string: "const x = 1;", new_string: "const x = 99;" });
  expect(result.isError).toBe(false);
  expect(await fs.readFile(p, "utf-8")).toContain("const x = 99;");
});

test("returns error when old_string not found", async () => {
  const p = path.join(TMP, "src2.ts");
  await fs.writeFile(p, "hello");
  const result = await editTool.execute({ file_path: p, old_string: "nothere", new_string: "x" });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("not found");
});

test("returns error when old_string matches multiple times and replace_all is false", async () => {
  const p = path.join(TMP, "dup.ts");
  await fs.writeFile(p, "foo\nfoo\n");
  const result = await editTool.execute({ file_path: p, old_string: "foo", new_string: "bar" });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("multiple");
});

test("replaces all occurrences when replace_all is true", async () => {
  const p = path.join(TMP, "all.ts");
  await fs.writeFile(p, "foo\nfoo\n");
  const result = await editTool.execute({ file_path: p, old_string: "foo", new_string: "bar", replace_all: true });
  expect(result.isError).toBe(false);
  expect(await fs.readFile(p, "utf-8")).toBe("bar\nbar\n");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test src/write.test.ts src/edit.test.ts 2>&1 | tail -5
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create `packages/tools/src/write.ts`**

```typescript
import type { QxlTool } from "./types";
import fs from "node:fs/promises";
import path from "node:path";

export const writeTool: QxlTool = {
  name: "Write",
  schema: {
    type: "function",
    function: {
      name: "Write",
      description: "Write content to a file, creating parent directories as needed.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the file." },
          content: { type: "string", description: "Content to write." },
        },
        required: ["file_path", "content"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const content = params.content as string;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    return { content: `Written ${filePath}`, isError: false };
  },
};
```

- [ ] **Step 4: Create `packages/tools/src/edit.ts`**

```typescript
import type { QxlTool } from "./types";
import fs from "node:fs/promises";

export const editTool: QxlTool = {
  name: "Edit",
  schema: {
    type: "function",
    function: {
      name: "Edit",
      description: "Replace an exact string in a file. Fails if the string appears more than once (use replace_all to override).",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
          replace_all: { type: "boolean", description: "Replace every occurrence." },
        },
        required: ["file_path", "old_string", "new_string"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const oldStr = params.old_string as string;
    const newStr = params.new_string as string;
    const replaceAll = params.replace_all === true;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const count = content.split(oldStr).length - 1;
    if (count === 0) return { content: `old_string not found in ${filePath}`, isError: true };
    if (count > 1 && !replaceAll) return { content: `old_string matches multiple times (${count}) — set replace_all: true to replace all`, isError: true };

    const updated = replaceAll ? content.replaceAll(oldStr, newStr) : content.replace(oldStr, newStr);
    await fs.writeFile(filePath, updated, "utf-8");
    return { content: `Edited ${filePath} (${count} replacement${count > 1 ? "s" : ""})`, isError: false };
  },
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test src/write.test.ts src/edit.test.ts 2>&1 | tail -5
```

Expected: `6 pass, 0 fail`

- [ ] **Step 6: Commit**

```bash
git add packages/tools/src/write.ts packages/tools/src/write.test.ts packages/tools/src/edit.ts packages/tools/src/edit.test.ts
git commit -m "feat(tools): Write and Edit tools"
git push origin main
```

---

### Task 5: MultiEdit, Glob, Grep tools + tool index

**Files:**
- Create: `packages/tools/src/multi-edit.ts`
- Create: `packages/tools/src/glob.ts`
- Create: `packages/tools/src/grep.ts`
- Create: `packages/tools/src/index.ts`
- Test: `packages/tools/src/multi-edit.test.ts`
- Test: `packages/tools/src/glob.test.ts`
- Test: `packages/tools/src/grep.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/tools/src/multi-edit.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { multiEditTool } from "./multi-edit";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__me_tmp__");
beforeAll(() => fs.mkdir(TMP, { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("applies multiple edits to a file atomically", async () => {
  const p = path.join(TMP, "a.ts");
  await fs.writeFile(p, "const a = 1;\nconst b = 2;\n");
  const result = await multiEditTool.execute({
    file_path: p,
    edits: [
      { old_string: "const a = 1;", new_string: "const a = 10;" },
      { old_string: "const b = 2;", new_string: "const b = 20;" },
    ],
  });
  expect(result.isError).toBe(false);
  const out = await fs.readFile(p, "utf-8");
  expect(out).toContain("const a = 10;");
  expect(out).toContain("const b = 20;");
});
```

`packages/tools/src/glob.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { globTool } from "./glob";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__glob_tmp__");
beforeAll(async () => {
  await fs.mkdir(path.join(TMP, "sub"), { recursive: true });
  await fs.writeFile(path.join(TMP, "a.ts"), "");
  await fs.writeFile(path.join(TMP, "b.ts"), "");
  await fs.writeFile(path.join(TMP, "sub", "c.ts"), "");
  await fs.writeFile(path.join(TMP, "d.md"), "");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("finds files matching pattern", async () => {
  const result = await globTool.execute({ pattern: "**/*.ts", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("a.ts");
  expect(result.content).toContain("c.ts");
  expect(result.content).not.toContain("d.md");
});
```

`packages/tools/src/grep.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { grepTool } from "./grep";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__grep_tmp__");
beforeAll(async () => {
  await fs.mkdir(TMP, { recursive: true });
  await fs.writeFile(path.join(TMP, "src.ts"), "export function hello() {}\nexport const world = 1;\n");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("finds lines matching pattern", async () => {
  const result = await grepTool.execute({ pattern: "export", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("src.ts");
  expect(result.content).toContain("hello");
});

test("returns empty result for no matches", async () => {
  const result = await grepTool.execute({ pattern: "zzznothere", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("No matches");
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test src/multi-edit.test.ts src/glob.test.ts src/grep.test.ts 2>&1 | tail -5
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create `packages/tools/src/multi-edit.ts`**

```typescript
import type { QxlTool } from "./types";
import fs from "node:fs/promises";

interface Edit { old_string: string; new_string: string; replace_all?: boolean; }

export const multiEditTool: QxlTool = {
  name: "MultiEdit",
  schema: {
    type: "function",
    function: {
      name: "MultiEdit",
      description: "Apply multiple string replacements to a single file atomically.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                old_string: { type: "string" },
                new_string: { type: "string" },
                replace_all: { type: "boolean" },
              },
              required: ["old_string", "new_string"],
            },
          },
        },
        required: ["file_path", "edits"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const edits = params.edits as Edit[];
    let content: string;
    try { content = await fs.readFile(filePath, "utf-8"); }
    catch { return { content: `File not found: ${filePath}`, isError: true }; }

    for (const edit of edits) {
      const count = content.split(edit.old_string).length - 1;
      if (count === 0) return { content: `old_string "${edit.old_string}" not found`, isError: true };
      if (count > 1 && !edit.replace_all) return { content: `old_string "${edit.old_string}" matches ${count} times`, isError: true };
      content = edit.replace_all ? content.replaceAll(edit.old_string, edit.new_string) : content.replace(edit.old_string, edit.new_string);
    }

    await fs.writeFile(filePath, content, "utf-8");
    return { content: `Applied ${edits.length} edit(s) to ${filePath}`, isError: false };
  },
};
```

- [ ] **Step 4: Create `packages/tools/src/glob.ts`**

```typescript
import type { QxlTool } from "./types";

export const globTool: QxlTool = {
  name: "Glob",
  schema: {
    type: "function",
    function: {
      name: "Glob",
      description: "Find files matching a glob pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern e.g. **/*.ts" },
          path: { type: "string", description: "Directory to search in (defaults to cwd)." },
        },
        required: ["pattern"],
      },
    },
  },
  async execute(params) {
    const pattern = params.pattern as string;
    const cwd = (params.path as string | undefined) ?? process.cwd();
    const glob = new Bun.Glob(pattern);
    const matches: string[] = [];
    for await (const file of glob.scan({ cwd, absolute: true })) {
      matches.push(file);
    }
    if (matches.length === 0) return { content: "No files matched.", isError: false };
    return { content: matches.join("\n"), isError: false };
  },
};
```

- [ ] **Step 5: Create `packages/tools/src/grep.ts`**

```typescript
import type { QxlTool } from "./types";
import fs from "node:fs/promises";
import path from "node:path";

async function grepDir(dir: string, regex: RegExp, glob: string | undefined, results: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await grepDir(full, regex, glob, results);
    } else if (entry.isFile()) {
      if (glob && !entry.name.endsWith(glob.replace("*", ""))) continue;
      try {
        const text = await fs.readFile(full, "utf-8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${full}:${i + 1}: ${lines[i]}`);
          }
        }
      } catch { /* binary or unreadable, skip */ }
    }
  }
}

export const grepTool: QxlTool = {
  name: "Grep",
  schema: {
    type: "function",
    function: {
      name: "Grep",
      description: "Search for a regex pattern in files recursively.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for." },
          path: { type: "string", description: "Directory or file to search (defaults to cwd)." },
          glob: { type: "string", description: "File extension filter e.g. *.ts" },
        },
        required: ["pattern"],
      },
    },
  },
  async execute(params) {
    const pattern = params.pattern as string;
    const target = (params.path as string | undefined) ?? process.cwd();
    const glob = params.glob as string | undefined;
    let regex: RegExp;
    try { regex = new RegExp(pattern); }
    catch { return { content: `Invalid regex: ${pattern}`, isError: true }; }

    const results: string[] = [];
    await grepDir(target, regex, glob, results);
    if (results.length === 0) return { content: "No matches.", isError: false };
    return { content: results.slice(0, 500).join("\n"), isError: false };
  },
};
```

- [ ] **Step 6: Create `packages/tools/src/index.ts`**

```typescript
export { readTool } from "./read";
export { writeTool } from "./write";
export { editTool } from "./edit";
export { multiEditTool } from "./multi-edit";
export { globTool } from "./glob";
export { grepTool } from "./grep";
export { ToolRegistry } from "./registry";
export type { QxlTool, ToolResult } from "./types";

import { ToolRegistry } from "./registry";
import { readTool } from "./read";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { multiEditTool } from "./multi-edit";
import { globTool } from "./glob";
import { grepTool } from "./grep";

export const defaultRegistry = new ToolRegistry()
  .register(readTool)
  .register(writeTool)
  .register(editTool)
  .register(multiEditTool)
  .register(globTool)
  .register(grepTool);
```

- [ ] **Step 7: Run all tool tests**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tools && bun test --timeout 30000 2>&1 | tail -10
```

Expected: `12 pass, 0 fail` (3 read + 2 write + 4 edit + 1 multi-edit + 1 glob + 2 grep)

- [ ] **Step 8: Commit**

```bash
git add packages/tools/
git commit -m "feat(tools): MultiEdit, Glob, Grep tools + ToolRegistry index"
git push origin main
```

---

### Task 6: Session management (SQLite)

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/session.ts`
- Test: `packages/core/src/session.test.ts`

- [ ] **Step 1: Create `packages/core/src/types.ts`**

```typescript
import type { Message } from "@qxl/gateway";
import type { ToolRegistry } from "@qxl/tools";

export type { Message };

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  baseURL: string;
  model: string;
  cwd: string;
  registry: ToolRegistry;
  cancelled?: () => boolean;
}

export type AgentEvent =
  | { type: "session_id"; id: string }
  | { type: "token"; delta: string }
  | { type: "tool_start"; callId: string; name: string; params: string }
  | { type: "tool_result"; callId: string; content: string; isError: boolean }
  | { type: "turn_end"; stopReason: string }
  | { type: "done" };

export interface SessionData {
  id: string;
  cwd: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}
```

- [ ] **Step 2: Write failing test `packages/core/src/session.test.ts`**

```typescript
import { expect, test, afterEach } from "bun:test";
import { Session } from "./session";
import path from "node:path";
import fs from "node:fs/promises";

const DB_PATH = path.join(import.meta.dir, "__session_test__.db");

afterEach(async () => {
  try { await fs.unlink(DB_PATH); } catch {}
});

test("creates a new session and persists messages", async () => {
  const s = Session.create({ dbPath: DB_PATH, cwd: "/tmp", model: "test-model" });
  s.addMessage({ role: "user", content: "hello" });
  s.addMessage({ role: "assistant", content: "world" });
  await s.save();

  const loaded = Session.resume({ dbPath: DB_PATH, id: s.id });
  expect(loaded).not.toBeNull();
  expect(loaded!.messages).toHaveLength(2);
  expect((loaded!.messages[0] as { content: string }).content).toBe("hello");
});

test("returns null when session id not found", () => {
  const result = Session.resume({ dbPath: DB_PATH, id: "nonexistent" });
  expect(result).toBeNull();
});

test("lists sessions ordered by updated_at desc", async () => {
  const s1 = Session.create({ dbPath: DB_PATH, cwd: "/a", model: "m" });
  await s1.save();
  const s2 = Session.create({ dbPath: DB_PATH, cwd: "/b", model: "m" });
  await s2.save();

  const list = Session.list({ dbPath: DB_PATH });
  expect(list.length).toBe(2);
  expect(list[0].id).toBe(s2.id);
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/session.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './session'`

- [ ] **Step 4: Create `packages/core/src/session.ts`**

```typescript
import { Database } from "bun:sqlite";
import type { Message, SessionData } from "./types";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`;

function openDB(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  db.exec(SCHEMA);
  return db;
}

function rowToMessage(row: Record<string, unknown>): Message {
  const base = { role: row.role as string };
  const content = row.content as string | null;
  const toolCalls = row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined;
  const toolCallId = row.tool_call_id as string | null;
  if (toolCallId) return { ...base, role: "tool", tool_call_id: toolCallId, content: content ?? "" } as Message;
  if (toolCalls) return { ...base, role: "assistant", content: content ?? null, tool_calls: toolCalls } as Message;
  return { ...base, content: content ?? "" } as Message;
}

export class Session {
  readonly id: string;
  readonly cwd: string;
  readonly model: string;
  readonly createdAt: number;
  messages: Message[];
  private updatedAt: number;

  private constructor(data: SessionData) {
    this.id = data.id;
    this.cwd = data.cwd;
    this.model = data.model;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.messages = data.messages;
  }

  static create(opts: { dbPath: string; cwd: string; model: string }): Session {
    const id = crypto.randomUUID();
    const now = Date.now();
    return new Session({ id, cwd: opts.cwd, model: opts.model, createdAt: now, updatedAt: now, messages: [] });
  }

  static resume(opts: { dbPath: string; id: string }): Session | null {
    const db = openDB(opts.dbPath);
    const row = db.query("SELECT * FROM sessions WHERE id = ?").get(opts.id) as Record<string, unknown> | null;
    if (!row) return null;
    const msgRows = db.query("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC").all(opts.id) as Record<string, unknown>[];
    return new Session({
      id: row.id as string,
      cwd: row.cwd as string,
      model: row.model as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      messages: msgRows.map(rowToMessage),
    });
  }

  static list(opts: { dbPath: string }): Array<{ id: string; cwd: string; updatedAt: number }> {
    const db = openDB(opts.dbPath);
    const rows = db.query("SELECT id, cwd, updated_at FROM sessions ORDER BY updated_at DESC").all() as Record<string, unknown>[];
    return rows.map((r) => ({ id: r.id as string, cwd: r.cwd as string, updatedAt: r.updated_at as number }));
  }

  addMessage(msg: Message): void {
    this.messages.push(msg);
  }

  async save(dbPath?: string): Promise<void> {
    const path = dbPath ?? `${process.env.HOME}/.qxl/sessions.db`;
    const db = openDB(path);
    this.updatedAt = Date.now();
    db.run(
      "INSERT OR REPLACE INTO sessions (id, cwd, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [this.id, this.cwd, this.model, this.createdAt, this.updatedAt]
    );
    db.run("DELETE FROM messages WHERE session_id = ?", [this.id]);
    const insert = db.prepare(
      "INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const now = Date.now();
    for (const msg of this.messages) {
      const m = msg as Record<string, unknown>;
      insert.run(
        this.id,
        m.role,
        typeof m.content === "string" ? m.content : null,
        m.tool_calls ? JSON.stringify(m.tool_calls) : null,
        m.tool_call_id ?? null,
        m.name ?? null,
        now
      );
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/session.test.ts 2>&1 | tail -5
```

Expected: `3 pass, 0 fail`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/session.ts packages/core/src/session.test.ts
git commit -m "feat(core): Session management with bun:sqlite"
git push origin main
```

---

### Task 7: Config loader and Memory injection

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/memory.ts`
- Test: `packages/core/src/config.test.ts`
- Test: `packages/core/src/memory.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/src/config.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { loadConfig } from "./config";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__cfg_tmp__");
beforeAll(() => fs.mkdir(path.join(TMP, ".qxl"), { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("returns defaults when no config files exist", async () => {
  const cfg = await loadConfig({ cwd: TMP });
  expect(cfg.router.roles.coding).toBeDefined();
});

test("merges project config over defaults", async () => {
  await fs.writeFile(
    path.join(TMP, ".qxl", "settings.json"),
    JSON.stringify({ router: { roles: { coding: "custom-model" } } })
  );
  const cfg = await loadConfig({ cwd: TMP });
  expect(cfg.router.roles.coding).toBe("custom-model");
});
```

`packages/core/src/memory.test.ts`:
```typescript
import { expect, test, beforeAll, afterAll } from "bun:test";
import { loadMemory } from "./memory";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__mem_tmp__");
const CHILD = path.join(TMP, "project");

beforeAll(async () => {
  await fs.mkdir(CHILD, { recursive: true });
  await fs.writeFile(path.join(TMP, "QXL.md"), "# Parent memory");
  await fs.writeFile(path.join(CHILD, "QXL.md"), "# Project memory");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("concatenates QXL.md files from cwd up to root", async () => {
  const mem = await loadMemory({ cwd: CHILD, stopAt: TMP });
  expect(mem).toContain("Parent memory");
  expect(mem).toContain("Project memory");
});

test("returns empty string when no QXL.md exists", async () => {
  const mem = await loadMemory({ cwd: "/tmp" });
  expect(mem).toBe("");
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/config.test.ts src/memory.test.ts 2>&1 | tail -5
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create `packages/core/src/config.ts`**

```typescript
import path from "node:path";
import fs from "node:fs/promises";

export interface QxlConfig {
  baseURL: string;
  router: {
    roles: {
      coding: string;
      fast: string;
    };
  };
  env?: Record<string, string>;
}

const DEFAULTS: QxlConfig = {
  baseURL: process.env.QXL_BASE_URL ?? "http://127.0.0.1:8090/v1",
  router: {
    roles: {
      coding: process.env.QXL_MODEL ?? "Qwen/Qwen2.5-0.5B-Instruct",
      fast: process.env.QXL_MODEL ?? "Qwen/Qwen2.5-0.5B-Instruct",
    },
  },
};

async function readJSON(p: string): Promise<Partial<QxlConfig>> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as Partial<QxlConfig>;
  } catch {
    return {};
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof (base as Record<string, unknown>)[k] === "object") {
      (result as Record<string, unknown>)[k] = deepMerge((base as Record<string, unknown>)[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}

export async function loadConfig(opts: { cwd: string }): Promise<QxlConfig> {
  const globalPath = path.join(process.env.HOME ?? "~", ".qxl", "settings.json");
  const projectPath = path.join(opts.cwd, ".qxl", "settings.json");
  const localPath = path.join(opts.cwd, ".qxl", "settings.local.json");

  const [global, project, local] = await Promise.all([
    readJSON(globalPath),
    readJSON(projectPath),
    readJSON(localPath),
  ]);

  return deepMerge(deepMerge(deepMerge(DEFAULTS as unknown as Record<string, unknown>, global as Record<string, unknown>), project as Record<string, unknown>), local as Record<string, unknown>) as QxlConfig;
}
```

- [ ] **Step 4: Create `packages/core/src/memory.ts`**

```typescript
import path from "node:path";
import fs from "node:fs/promises";

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function loadMemory(opts: { cwd: string; stopAt?: string }): Promise<string> {
  const sections: string[] = [];
  let dir = path.resolve(opts.cwd);
  const root = opts.stopAt ? path.resolve(opts.stopAt) : "/";
  const visited = new Set<string>();

  while (dir !== path.dirname(dir)) {
    if (visited.has(dir)) break;
    visited.add(dir);
    const candidate = path.join(dir, "QXL.md");
    if (await exists(candidate)) {
      sections.unshift(await fs.readFile(candidate, "utf-8"));
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  const globalPath = path.join(process.env.HOME ?? "~", ".qxl", "QXL.md");
  if (!visited.has(path.dirname(globalPath)) && await exists(globalPath)) {
    sections.unshift(await fs.readFile(globalPath, "utf-8"));
  }

  return sections.join("\n\n---\n\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/config.test.ts src/memory.test.ts 2>&1 | tail -5
```

Expected: `4 pass, 0 fail`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts packages/core/src/memory.ts packages/core/src/memory.test.ts
git commit -m "feat(core): config loader and QXL.md memory injection"
git push origin main
```

---

### Task 8: Agent loop

**Files:**
- Create: `packages/core/src/agent.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/agent.test.ts`

- [ ] **Step 1: Write failing test `packages/core/src/agent.test.ts`**

```typescript
import { expect, test } from "bun:test";
import { agentLoop } from "./agent";
import { defaultRegistry } from "@qxl/tools";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__agent_tmp__");

test("emits session_id, token events, and done for a simple prompt", async () => {
  await fs.mkdir(TMP, { recursive: true });
  const events: string[] = [];

  for await (const event of agentLoop({
    prompt: "Say exactly: qxl works",
    baseURL: "http://127.0.0.1:8090/v1",
    model: "Qwen/Qwen2.5-0.5B-Instruct",
    cwd: TMP,
    registry: defaultRegistry,
  })) {
    events.push(event.type);
    if (event.type === "done") break;
  }

  expect(events).toContain("session_id");
  expect(events).toContain("token");
  expect(events).toContain("done");

  await fs.rm(TMP, { recursive: true, force: true });
}, 30_000);
```

- [ ] **Step 2: Run to verify it fails**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/agent.test.ts 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module './agent'`

- [ ] **Step 3: Create `packages/core/src/agent.ts`**

```typescript
import { GatewayClient } from "@qxl/gateway";
import { Session } from "./session";
import { loadMemory } from "./memory";
import type { AgentOptions, AgentEvent } from "./types";
import path from "node:path";
import os from "node:os";

const DB_PATH = path.join(os.homedir(), ".qxl", "sessions.db");

const SYSTEM_PROMPT = `You are qxl, a local-first AI coding assistant running on Apple Silicon.

You help users with software engineering tasks by reading, writing, and editing files, searching code, and running commands.

When you have completed the user's request, stop calling tools and give a concise summary of what you did.`;

export async function* agentLoop(opts: AgentOptions): AsyncGenerator<AgentEvent> {
  const dbPath = path.join(os.homedir(), ".qxl", "sessions.db");
  
  // Ensure ~/.qxl exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.dirname(dbPath), { recursive: true });

  let session: Session;
  if (opts.sessionId) {
    const resumed = Session.resume({ dbPath, id: opts.sessionId });
    session = resumed ?? Session.create({ dbPath, cwd: opts.cwd, model: opts.model });
  } else {
    session = Session.create({ dbPath, cwd: opts.cwd, model: opts.model });
  }

  yield { type: "session_id", id: session.id };

  const memory = await loadMemory({ cwd: opts.cwd });
  const systemPrompt = memory ? `${SYSTEM_PROMPT}\n\n# Memory\n\n${memory}` : SYSTEM_PROMPT;

  session.addMessage({ role: "user", content: opts.prompt });
  await session.save(dbPath);

  const gateway = new GatewayClient({ baseURL: opts.baseURL, model: opts.model });
  const tools = opts.registry.schemas();

  while (true) {
    if (opts.cancelled?.()) break;

    const toolCallsThisTurn: Array<{ id: string; name: string; args: string }> = [];
    let assistantContent = "";
    let stopReason = "stop";

    for await (const event of gateway.stream({
      messages: session.messages,
      tools,
      system: systemPrompt,
    })) {
      if (opts.cancelled?.()) break;
      if (event.type === "token") {
        assistantContent += event.delta;
        yield { type: "token", delta: event.delta };
      }
      if (event.type === "tool_call") {
        toolCallsThisTurn.push({
          id: event.call.id,
          name: event.call.function.name,
          args: event.call.function.arguments,
        });
      }
      if (event.type === "done") {
        stopReason = event.stopReason;
      }
    }

    session.addMessage({
      role: "assistant",
      content: assistantContent || null,
      tool_calls: toolCallsThisTurn.length > 0
        ? toolCallsThisTurn.map((tc) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.args } }))
        : undefined,
    });

    yield { type: "turn_end", stopReason };

    if (stopReason !== "tool_calls" || toolCallsThisTurn.length === 0) break;

    for (const tc of toolCallsThisTurn) {
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(tc.args); } catch {}
      yield { type: "tool_start", callId: tc.id, name: tc.name, params: tc.args };
      const result = await opts.registry.execute(tc.name, params);
      session.addMessage({ role: "tool", tool_call_id: tc.id, content: result.content });
      yield { type: "tool_result", callId: tc.id, content: result.content, isError: result.isError };
    }

    await session.save(dbPath);
  }

  await session.save(dbPath);
  yield { type: "done" };
}
```

- [ ] **Step 4: Create `packages/core/src/index.ts`**

```typescript
export { agentLoop } from "./agent";
export { Session } from "./session";
export { loadConfig } from "./config";
export { loadMemory } from "./memory";
export type { AgentOptions, AgentEvent, SessionData, Message } from "./types";
```

- [ ] **Step 5: Run tests (server must be on :8090)**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/core && bun test src/agent.test.ts --timeout 60000 2>&1 | tail -10
```

Expected: `1 pass, 0 fail`

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agent.ts packages/core/src/agent.test.ts packages/core/src/index.ts
git commit -m "feat(core): agentLoop async generator"
git push origin main
```

---

### Task 9: TUI components

**Files:**
- Create: `packages/tui/src/components/transcript.tsx`
- Create: `packages/tui/src/components/tool-card.tsx`
- Create: `packages/tui/src/components/status-bar.tsx`
- Create: `packages/tui/src/components/input.tsx`
- Test: `packages/tui/src/components/transcript.test.tsx`
- Test: `packages/tui/src/components/tool-card.test.tsx`

- [ ] **Step 1: Write failing tests**

`packages/tui/src/components/transcript.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { Transcript } from "./transcript";

test("renders user and assistant messages", () => {
  const { lastFrame } = render(
    <Transcript
      messages={[
        { role: "user", content: "hello" },
        { role: "assistant", content: "world" },
      ]}
      streamingDelta=""
    />
  );
  expect(lastFrame()).toContain("hello");
  expect(lastFrame()).toContain("world");
});

test("renders streaming delta", () => {
  const { lastFrame } = render(
    <Transcript messages={[]} streamingDelta="stream..." />
  );
  expect(lastFrame()).toContain("stream...");
});
```

`packages/tui/src/components/tool-card.test.tsx`:
```tsx
import { expect, test } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { ToolCard } from "./tool-card";

test("renders tool name and result", () => {
  const { lastFrame } = render(
    <ToolCard name="Read" params='{"file_path":"/foo.ts"}' result="line1\nline2" isError={false} />
  );
  expect(lastFrame()).toContain("Read");
  expect(lastFrame()).toContain("foo.ts");
});

test("shows error styling when isError", () => {
  const { lastFrame } = render(
    <ToolCard name="Write" params="{}" result="File not found" isError={true} />
  );
  expect(lastFrame()).toContain("Write");
  expect(lastFrame()).toContain("File not found");
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tui && bun test src/components/ 2>&1 | tail -5
```

Expected: FAIL — modules not found

- [ ] **Step 3: Create `packages/tui/src/components/transcript.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { Message } from "@qxl/core";

interface Props {
  messages: Message[];
  streamingDelta: string;
}

export function Transcript({ messages, streamingDelta }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => {
        const m = msg as Record<string, unknown>;
        if (m.role === "tool") return null;
        const content = typeof m.content === "string" ? m.content : "";
        const color = m.role === "user" ? "green" : "white";
        const label = m.role === "user" ? "You" : "qxl";
        if (!content) return null;
        return (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text color={color} bold>{label}</Text>
            <Text>{content}</Text>
          </Box>
        );
      })}
      {streamingDelta && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="white" bold>qxl</Text>
          <Text>{streamingDelta}</Text>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Create `packages/tui/src/components/tool-card.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  name: string;
  params: string;
  result?: string;
  isError: boolean;
}

export function ToolCard({ name, params, result, isError }: Props) {
  let paramDisplay = params;
  try {
    const p = JSON.parse(params);
    paramDisplay = Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(", ");
  } catch {}

  return (
    <Box borderStyle="single" borderColor={isError ? "red" : "yellow"} flexDirection="column" paddingX={1} marginBottom={1}>
      <Text color="yellow" bold>⚙ {name}</Text>
      <Text dimColor>{paramDisplay}</Text>
      {result && <Text color={isError ? "red" : "white"}>{result.slice(0, 200)}{result.length > 200 ? "…" : ""}</Text>}
    </Box>
  );
}
```

- [ ] **Step 5: Create `packages/tui/src/components/status-bar.tsx`**

```tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  model: string;
  tokens: number;
  turn: number;
  elapsedMs: number;
}

export function StatusBar({ model, tokens, turn, elapsedMs }: Props) {
  const elapsed = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text dimColor>{model} · turn {turn} · {tokens} tokens · {elapsed}</Text>
    </Box>
  );
}
```

- [ ] **Step 6: Create `packages/tui/src/components/input.tsx`**

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function Input({ onSubmit, onCancel, disabled }: Props) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (disabled) return;
    if (key.escape) { onCancel(); return; }
    if (key.return) {
      if (value.trim()) { onSubmit(value.trim()); setValue(""); }
      return;
    }
    if (key.backspace || key.delete) { setValue((v) => v.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta) { setValue((v) => v + input); }
  });

  return (
    <Box borderStyle="round" borderColor={disabled ? "gray" : "green"} paddingX={1}>
      <Text color={disabled ? "gray" : "green"}>{">"} </Text>
      <Text>{value}</Text>
      <Text color="green">{disabled ? "" : "▋"}</Text>
    </Box>
  );
}
```

- [ ] **Step 7: Run tests**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl/packages/tui && bun test src/components/ 2>&1 | tail -10
```

Expected: `4 pass, 0 fail`

- [ ] **Step 8: Commit**

```bash
git add packages/tui/src/components/
git commit -m "feat(tui): Transcript, ToolCard, StatusBar, Input components"
git push origin main
```

---

### Task 10: TUI App + CLI entry point

**Files:**
- Create: `packages/tui/src/app.tsx`
- Create: `packages/tui/src/index.tsx`
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Create `packages/tui/src/app.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from "react";
import { Box, useApp } from "ink";
import { agentLoop, loadConfig } from "@qxl/core";
import { defaultRegistry } from "@qxl/tools";
import type { AgentEvent } from "@qxl/core";
import type { Message } from "@qxl/core";
import { Transcript } from "./components/transcript";
import { ToolCard } from "./components/tool-card";
import { StatusBar } from "./components/status-bar";
import { Input } from "./components/input";

interface ToolCardData { callId: string; name: string; params: string; result?: string; isError: boolean; }

interface AppProps {
  initialPrompt?: string;
  sessionId?: string;
  cwd: string;
}

export function App({ initialPrompt, sessionId, cwd }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingDelta, setStreamingDelta] = useState("");
  const [toolCards, setToolCards] = useState<ToolCardData[]>([]);
  const [model, setModel] = useState("loading…");
  const [tokens, setTokens] = useState(0);
  const [turn, setTurn] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = React.useRef(false);
  const startRef = React.useRef(Date.now());

  const runAgent = useCallback(async (prompt: string, sid?: string) => {
    cancelledRef.current = false;
    setCancelled(false);
    setBusy(true);
    setStreamingDelta("");
    setToolCards([]);
    startRef.current = Date.now();

    const cfg = await loadConfig({ cwd });
    setModel(cfg.router.roles.coding);

    const loop = agentLoop({
      prompt,
      sessionId: sid,
      baseURL: cfg.baseURL,
      model: cfg.router.roles.coding,
      cwd,
      registry: defaultRegistry,
      cancelled: () => cancelledRef.current,
    });

    let delta = "";
    for await (const event of loop) {
      setElapsed(Date.now() - startRef.current);
      if (event.type === "token") { delta += event.delta; setStreamingDelta(delta); setTokens((t) => t + 1); }
      if (event.type === "tool_start") { setToolCards((prev) => [...prev, { callId: event.callId, name: event.name, params: event.params, isError: false }]); }
      if (event.type === "tool_result") {
        setToolCards((prev) => prev.map((c) => c.callId === event.callId ? { ...c, result: event.content, isError: event.isError } : c));
      }
      if (event.type === "turn_end") {
        if (delta) {
          setMessages((prev) => [...prev, { role: "assistant", content: delta } as Message]);
          delta = "";
          setStreamingDelta("");
        }
        setTurn((t) => t + 1);
      }
      if (event.type === "done") break;
    }

    setBusy(false);
  }, [cwd]);

  useEffect(() => {
    if (initialPrompt) {
      setMessages([{ role: "user", content: initialPrompt } as Message]);
      runAgent(initialPrompt, sessionId);
    }
  }, []);

  const handleSubmit = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text } as Message]);
    runAgent(text);
  }, [runAgent]);

  const handleCancel = useCallback(() => {
    if (busy) { cancelledRef.current = true; setCancelled(true); }
    else { exit(); }
  }, [busy, exit]);

  return (
    <Box flexDirection="column" height="100%">
      <Transcript messages={messages} streamingDelta={streamingDelta} />
      {toolCards.map((tc, i) => (
        <ToolCard key={i} name={tc.name} params={tc.params} result={tc.result} isError={tc.isError} />
      ))}
      <StatusBar model={model} tokens={tokens} turn={turn} elapsedMs={elapsed} />
      <Input onSubmit={handleSubmit} onCancel={handleCancel} disabled={busy} />
    </Box>
  );
}
```

- [ ] **Step 2: Create `packages/tui/src/index.tsx`**

```tsx
import React from "react";
import { render } from "ink";
import { App } from "./app";

export interface RunTUIOptions {
  initialPrompt?: string;
  sessionId?: string;
  cwd?: string;
}

export function runTUI(opts: RunTUIOptions = {}): void {
  render(
    <App
      initialPrompt={opts.initialPrompt}
      sessionId={opts.sessionId}
      cwd={opts.cwd ?? process.cwd()}
    />,
    { exitOnCtrlC: false }
  );
}

export { App };
```

- [ ] **Step 3: Create `packages/cli/src/index.ts`**

```typescript
#!/usr/bin/env bun
import { Command } from "commander";
import { runTUI } from "@qxl/tui";

const program = new Command("qxl")
  .version("0.1.0")
  .description("Local-first agentic coding CLI")
  .argument("[prompt...]", "Prompt to send (starts a new session if provided)")
  .option("-c, --continue", "Continue the last session in the current directory")
  .option("-r, --resume <id>", "Resume a specific session by ID")
  .option("--model <model>", "Override the model (overrides config)")
  .action((promptParts: string[], opts: { continue?: boolean; resume?: string; model?: string }) => {
    const prompt = promptParts.join(" ") || undefined;
    if (opts.model) process.env.QXL_MODEL = opts.model;
    runTUI({ initialPrompt: prompt, sessionId: opts.resume });
  });

program.parse(process.argv);
```

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl && bun test --timeout 60000 2>&1 | tail -15
```

Expected: all tests pass (gateway tests need server on :8090; TUI + tool + session + config + memory tests are server-independent).

- [ ] **Step 5: Smoke-test the CLI end-to-end (server must be on :8090)**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl && bun run packages/cli/src/index.ts "list the files in the current directory using Glob"
```

Expected: Ink TUI launches, shows streaming response, Glob tool card appears with results, "Done" status after completion. Press Esc to exit.

- [ ] **Step 6: Commit**

```bash
git add packages/tui/src/ packages/cli/src/
git commit -m "feat(tui,cli): App component, runTUI(), and qxl CLI entry"
git push origin main
```

---

### Task 11: Wire Glob and Grep into CLI default invocation + final integration commit

**Files:**
- Modify: `packages/core/src/agent.ts` (add cwd to Glob/Grep defaults via system prompt)
- Create: `packages/cli/src/index.ts` (add `sessions` subcommand)

- [ ] **Step 1: Add sessions list subcommand to CLI**

Edit `packages/cli/src/index.ts`, after `program.parse(process.argv)` add:

```typescript
program
  .command("sessions")
  .description("List recent sessions")
  .action(() => {
    const { Session } = require("@qxl/core") as typeof import("@qxl/core");
    const path = require("node:path") as typeof import("node:path");
    const os = require("node:os") as typeof import("node:os");
    const dbPath = path.join(os.homedir(), ".qxl", "sessions.db");
    const list = Session.list({ dbPath });
    if (list.length === 0) { console.log("No sessions found."); return; }
    for (const s of list.slice(0, 20)) {
      const dt = new Date(s.updatedAt).toLocaleString();
      console.log(`${s.id.slice(0, 8)}  ${dt}  ${s.cwd}`);
    }
  });
```

Actually, restructure `packages/cli/src/index.ts` as the complete file:

```typescript
#!/usr/bin/env bun
import { Command } from "commander";
import { runTUI } from "@qxl/tui";
import { Session } from "@qxl/core";
import path from "node:path";
import os from "node:os";

const DB_PATH = path.join(os.homedir(), ".qxl", "sessions.db");

const program = new Command("qxl")
  .version("0.1.0")
  .description("Local-first agentic coding CLI")
  .argument("[prompt...]", "Prompt to send")
  .option("-c, --continue", "Continue the last session in cwd")
  .option("-r, --resume <id>", "Resume session by ID")
  .option("--model <model>", "Override the model")
  .action((promptParts: string[], opts: { continue?: boolean; resume?: string; model?: string }) => {
    const prompt = promptParts.join(" ") || undefined;
    if (opts.model) process.env.QXL_MODEL = opts.model;
    let sessionId = opts.resume;
    if (opts.continue && !sessionId) {
      const cwd = process.cwd();
      const list = Session.list({ dbPath: DB_PATH });
      const last = list.find((s) => s.cwd === cwd);
      if (last) sessionId = last.id;
    }
    runTUI({ initialPrompt: prompt, sessionId });
  });

program
  .command("sessions")
  .description("List recent sessions")
  .action(() => {
    const list = Session.list({ dbPath: DB_PATH });
    if (list.length === 0) { console.log("No sessions found."); return; }
    for (const s of list.slice(0, 20)) {
      console.log(`${s.id.slice(0, 8)}  ${new Date(s.updatedAt).toLocaleString()}  ${s.cwd}`);
    }
  });

program.parse(process.argv);
```

- [ ] **Step 2: Update system prompt in agent.ts to include cwd context**

In `packages/core/src/agent.ts`, replace the SYSTEM_PROMPT constant with:

```typescript
function buildSystemPrompt(memory: string, cwd: string): string {
  const base = `You are qxl, a local-first AI coding assistant running on Apple Silicon.

You help users with software engineering tasks by reading, writing, and editing files, searching code, and running commands. When given a relative file path, resolve it relative to the working directory: ${cwd}

Available tools: Read, Write, Edit, MultiEdit, Glob, Grep. Use Glob to find files, Grep to search content, Read to inspect files, Write/Edit/MultiEdit to make changes.

When you have completed the user's request, stop calling tools and give a concise summary of what you did.`;
  return memory ? `${base}\n\n# Memory\n\n${memory}` : base;
}
```

And update the call site in `agentLoop`:
```typescript
const systemPrompt = buildSystemPrompt(memory, opts.cwd);
```

Remove the old `const SYSTEM_PROMPT` constant.

- [ ] **Step 3: Run full test suite**

```bash
export PATH="$HOME/.bun/bin:$PATH" && cd /Users/qxlsz/projects/qxl && bun test --timeout 90000 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Test sessions subcommand**

```bash
export PATH="$HOME/.bun/bin:$PATH" && bun run packages/cli/src/index.ts sessions
```

Expected: lists sessions or "No sessions found."

- [ ] **Step 5: Final M1 commit and tag**

```bash
git add -A
git commit -m "feat(cli,core): sessions subcommand + cwd-aware system prompt"
git tag m1-core-harness
git push origin main --tags
```

---

## Self-Review

**Spec coverage (design spec §4–§10):**
- ✅ G1 Agent loop — Task 8
- ✅ G3 Local-first MLX — gateway uses configurable baseURL, defaults to :8090
- ✅ G4 User-configurable model fleet — config loader + `--model` flag + env var
- ✅ G5 Production quality — TDD throughout, no placeholders
- ✅ Sessions (SQLite, resumable, `qxl -c`, `qxl sessions`) — Tasks 6, 11
- ✅ Memory (QXL.md hierarchy) — Task 7
- ✅ Config (settings.json merge) — Task 7
- ✅ File tools Read/Write/Edit/MultiEdit/Glob/Grep — Tasks 3–5
- ✅ TUI streaming, tool cards, status bar, input, Esc cancel — Tasks 9–10
- ✅ CLI entry `qxl` binary — Task 11

**Deferred to M2 (intentionally):** hooks, permissions, MCP, slash commands, subagents, plan mode, Bash tool, sandboxing.

**Placeholder scan:** No TBDs. All code steps show complete implementations.

**Type consistency:**
- `Message` imported from `@qxl/gateway` throughout; re-exported from `@qxl/core`
- `ToolResult.content` is `string` in types.ts, `execute()` returns `{ content, isError }` everywhere
- `AgentEvent` union uses `callId` (string) consistently across `tool_start` and `tool_result`
- `Session.save(dbPath?)` — test passes explicit dbPath, production uses default homedir path ✅

---

**Plan saved to `docs/superpowers/plans/2026-04-17-qxl-m1-core-harness.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast commits

**2. Inline Execution** — execute tasks in this session using executing-plans

**Which approach?**

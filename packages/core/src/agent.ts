import { GatewayClient } from "@qxl/gateway";
import { Session } from "./session";
import { loadMemory } from "./memory";
import type { AgentOptions, AgentEvent } from "./types";
import path from "node:path";
import os from "node:os";
import { mkdir } from "node:fs/promises";

const DB_PATH = path.join(os.homedir(), ".qxl", "sessions.db");

function buildSystemPrompt(memory: string, cwd: string): string {
  const base = `You are qxl, a local-first AI coding assistant running on Apple Silicon.

You help users with software engineering tasks by reading, writing, and editing files, searching code, and running commands. When given a relative file path, resolve it relative to the working directory: ${cwd}

Available tools: Read, Write, Edit, MultiEdit, Glob, Grep. Use Glob to find files, Grep to search content, Read to inspect files, Write/Edit/MultiEdit to make changes.

When you have completed the user's request, stop calling tools and give a concise summary of what you did.`;
  return memory ? `${base}\n\n# Memory\n\n${memory}` : base;
}

export async function* agentLoop(opts: AgentOptions): AsyncGenerator<AgentEvent> {
  await mkdir(path.dirname(DB_PATH), { recursive: true });

  let session: Session;
  if (opts.sessionId) {
    const resumed = Session.resume({ dbPath: DB_PATH, id: opts.sessionId });
    session = resumed ?? Session.create({ dbPath: DB_PATH, cwd: opts.cwd, model: opts.model });
  } else {
    session = Session.create({ dbPath: DB_PATH, cwd: opts.cwd, model: opts.model });
  }

  yield { type: "session_id", id: session.id };

  const memory = await loadMemory({ cwd: opts.cwd });
  const systemPrompt = buildSystemPrompt(memory, opts.cwd);

  session.addMessage({ role: "user", content: opts.prompt });
  await session.save(DB_PATH);

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
        ? toolCallsThisTurn.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          }))
        : undefined,
    });

    yield { type: "turn_end", stopReason };

    if (stopReason !== "tool_calls" || toolCallsThisTurn.length === 0) break;

    for (const tc of toolCallsThisTurn) {
      let params: Record<string, unknown> = {};
      try { params = JSON.parse(tc.args); } catch {}
      yield { type: "tool_start", callId: tc.id, name: tc.name, params: tc.args };
      const result = await opts.registry.execute(tc.name, params);
      session.addMessage({ role: "tool", tool_call_id: tc.id, content: result.content } as Parameters<typeof session.addMessage>[0]);
      yield { type: "tool_result", callId: tc.id, content: result.content, isError: result.isError };
    }

    await session.save(DB_PATH);
  }

  await session.save(DB_PATH);
  yield { type: "done" };
}

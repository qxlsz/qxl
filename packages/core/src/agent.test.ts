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

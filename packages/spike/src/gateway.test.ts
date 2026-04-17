import { expect, test } from "bun:test";
import { streamCompletion } from "./gateway";
import { ALL_TOOLS } from "./tools";
import type { ToolCall } from "./gateway";

test("streams at least one token from local server", async () => {
  const tokens: string[] = [];
  await streamCompletion({
    baseURL: "http://127.0.0.1:8090/v1",
    model: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit",
    messages: [{ role: "user", content: "Say exactly: hello" }],
    onToken: (t) => tokens.push(t),
    onDone: () => {},
  });
  expect(tokens.length).toBeGreaterThan(0);
  expect(tokens.join("").toLowerCase()).toContain("hello");
}, 30_000);

test("returns a tool call for a file-reading prompt", async () => {
  const calls: ToolCall[] = [];
  let stopReason = "";

  await streamCompletion({
    baseURL: "http://127.0.0.1:8090/v1",
    model: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit",
    messages: [
      {
        role: "user",
        content: "Please read the file at ./package.json using the read_file tool.",
      },
    ],
    tools: ALL_TOOLS,
    onToken: () => {},
    onToolCall: (c) => calls.push(c),
    onDone: (r) => { stopReason = r; },
  });

  expect(calls.length).toBeGreaterThan(0);
  expect(calls[0].function.name).toBe("read_file");
  const args = JSON.parse(calls[0].function.arguments);
  expect(args).toHaveProperty("path");
  expect(stopReason).toBe("tool_calls");
}, 60_000);

import { expect, test } from "bun:test";
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

  const joined = events.join("").toLowerCase();
  expect(events.length).toBeGreaterThan(0);
  expect(joined.includes("hi") || joined.includes("hello")).toBe(true);
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

import { expect, test } from "bun:test";
import { streamCompletion } from "./gateway";

test("streams at least one token from local server", async () => {
  const tokens: string[] = [];
  await streamCompletion({
    baseURL: "http://127.0.0.1:8080/v1",
    model: "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit",
    messages: [{ role: "user", content: "Say exactly: hello" }],
    onToken: (t) => tokens.push(t),
    onDone: () => {},
  });
  expect(tokens.length).toBeGreaterThan(0);
  expect(tokens.join("").toLowerCase()).toContain("hello");
}, 30_000);

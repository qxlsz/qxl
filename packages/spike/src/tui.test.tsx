import { expect, test } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { StreamOutput } from "./tui";

test("renders streamed tokens progressively", () => {
  const { lastFrame, rerender } = render(<StreamOutput tokens={["Hello"]} done={false} />);
  expect(lastFrame()).toContain("Hello");

  rerender(<StreamOutput tokens={["Hello", ", world"]} done={false} />);
  expect(lastFrame()).toContain("Hello, world");

  rerender(<StreamOutput tokens={["Hello", ", world", "!"]} done={true} />);
  expect(lastFrame()).toContain("Hello, world!");
  expect(lastFrame()).toContain("Done");
});

test("renders tool calls", () => {
  const { lastFrame } = render(
    <StreamOutput
      tokens={[]}
      done={false}
      toolCalls={[{ name: "read_file", args: '{"path":"./package.json"}' }]}
    />
  );
  expect(lastFrame()).toContain("read_file");
  expect(lastFrame()).toContain("package.json");
});

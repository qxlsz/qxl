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

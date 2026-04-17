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

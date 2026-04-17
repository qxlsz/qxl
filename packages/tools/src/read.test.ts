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

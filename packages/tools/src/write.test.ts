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

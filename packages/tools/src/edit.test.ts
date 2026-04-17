import { expect, test, beforeAll, afterAll } from "bun:test";
import { editTool } from "./edit";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__edit_tmp__");
beforeAll(() => fs.mkdir(TMP, { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("replaces unique string", async () => {
  const p = path.join(TMP, "src.ts");
  await fs.writeFile(p, "const x = 1;\nconst y = 2;\n");
  const result = await editTool.execute({ file_path: p, old_string: "const x = 1;", new_string: "const x = 99;" });
  expect(result.isError).toBe(false);
  expect(await fs.readFile(p, "utf-8")).toContain("const x = 99;");
});

test("returns error when old_string not found", async () => {
  const p = path.join(TMP, "src2.ts");
  await fs.writeFile(p, "hello");
  const result = await editTool.execute({ file_path: p, old_string: "nothere", new_string: "x" });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("not found");
});

test("returns error when old_string matches multiple times and replace_all is false", async () => {
  const p = path.join(TMP, "dup.ts");
  await fs.writeFile(p, "foo\nfoo\n");
  const result = await editTool.execute({ file_path: p, old_string: "foo", new_string: "bar" });
  expect(result.isError).toBe(true);
  expect(result.content).toContain("multiple");
});

test("replaces all occurrences when replace_all is true", async () => {
  const p = path.join(TMP, "all.ts");
  await fs.writeFile(p, "foo\nfoo\n");
  const result = await editTool.execute({ file_path: p, old_string: "foo", new_string: "bar", replace_all: true });
  expect(result.isError).toBe(false);
  expect(await fs.readFile(p, "utf-8")).toBe("bar\nbar\n");
});

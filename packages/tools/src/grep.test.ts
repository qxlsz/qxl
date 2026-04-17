import { expect, test, beforeAll, afterAll } from "bun:test";
import { grepTool } from "./grep";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__grep_tmp__");
beforeAll(async () => {
  await fs.mkdir(TMP, { recursive: true });
  await fs.writeFile(path.join(TMP, "src.ts"), "export function hello() {}\nexport const world = 1;\n");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("finds lines matching pattern", async () => {
  const result = await grepTool.execute({ pattern: "export", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("src.ts");
  expect(result.content).toContain("hello");
});

test("returns empty result for no matches", async () => {
  const result = await grepTool.execute({ pattern: "zzznothere", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("No matches");
});

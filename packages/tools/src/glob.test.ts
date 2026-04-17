import { expect, test, beforeAll, afterAll } from "bun:test";
import { globTool } from "./glob";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__glob_tmp__");
beforeAll(async () => {
  await fs.mkdir(path.join(TMP, "sub"), { recursive: true });
  await fs.writeFile(path.join(TMP, "a.ts"), "");
  await fs.writeFile(path.join(TMP, "b.ts"), "");
  await fs.writeFile(path.join(TMP, "sub", "c.ts"), "");
  await fs.writeFile(path.join(TMP, "d.md"), "");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("finds files matching pattern", async () => {
  const result = await globTool.execute({ pattern: "**/*.ts", path: TMP });
  expect(result.isError).toBe(false);
  expect(result.content).toContain("a.ts");
  expect(result.content).toContain("c.ts");
  expect(result.content).not.toContain("d.md");
});

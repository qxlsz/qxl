import { expect, test, beforeAll, afterAll } from "bun:test";
import { multiEditTool } from "./multi-edit";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__me_tmp__");
beforeAll(() => fs.mkdir(TMP, { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("applies multiple edits to a file atomically", async () => {
  const p = path.join(TMP, "a.ts");
  await fs.writeFile(p, "const a = 1;\nconst b = 2;\n");
  const result = await multiEditTool.execute({
    file_path: p,
    edits: [
      { old_string: "const a = 1;", new_string: "const a = 10;" },
      { old_string: "const b = 2;", new_string: "const b = 20;" },
    ],
  });
  expect(result.isError).toBe(false);
  const out = await fs.readFile(p, "utf-8");
  expect(out).toContain("const a = 10;");
  expect(out).toContain("const b = 20;");
});

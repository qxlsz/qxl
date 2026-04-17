import { expect, test, beforeAll, afterAll } from "bun:test";
import { loadMemory } from "./memory";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__mem_tmp__");
const CHILD = path.join(TMP, "project");

beforeAll(async () => {
  await fs.mkdir(CHILD, { recursive: true });
  await fs.writeFile(path.join(TMP, "QXL.md"), "# Parent memory");
  await fs.writeFile(path.join(CHILD, "QXL.md"), "# Project memory");
});
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("concatenates QXL.md files from cwd up to root", async () => {
  const mem = await loadMemory({ cwd: CHILD, stopAt: TMP });
  expect(mem).toContain("Parent memory");
  expect(mem).toContain("Project memory");
});

test("returns empty string when no QXL.md exists", async () => {
  const mem = await loadMemory({ cwd: "/tmp" });
  expect(mem).toBe("");
});

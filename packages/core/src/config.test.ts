import { expect, test, beforeAll, afterAll } from "bun:test";
import { loadConfig } from "./config";
import path from "node:path";
import fs from "node:fs/promises";

const TMP = path.join(import.meta.dir, "__cfg_tmp__");
beforeAll(() => fs.mkdir(path.join(TMP, ".qxl"), { recursive: true }));
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

test("returns defaults when no config files exist", async () => {
  const cfg = await loadConfig({ cwd: TMP });
  expect(cfg.router.roles.coding).toBeDefined();
});

test("merges project config over defaults", async () => {
  await fs.writeFile(
    path.join(TMP, ".qxl", "settings.json"),
    JSON.stringify({ router: { roles: { coding: "custom-model" } } })
  );
  const cfg = await loadConfig({ cwd: TMP });
  expect(cfg.router.roles.coding).toBe("custom-model");
});

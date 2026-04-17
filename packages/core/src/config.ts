import path from "node:path";
import fs from "node:fs/promises";

export interface QxlConfig {
  baseURL: string;
  router: {
    roles: {
      coding: string;
      fast: string;
    };
  };
  env?: Record<string, string>;
}

const DEFAULTS: QxlConfig = {
  baseURL: process.env.QXL_BASE_URL ?? "http://127.0.0.1:8090/v1",
  router: {
    roles: {
      coding: process.env.QXL_MODEL ?? "Qwen/Qwen2.5-0.5B-Instruct",
      fast: process.env.QXL_MODEL ?? "Qwen/Qwen2.5-0.5B-Instruct",
    },
  },
};

async function readJSON(p: string): Promise<Partial<QxlConfig>> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as Partial<QxlConfig>;
  } catch {
    return {};
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof (base as Record<string, unknown>)[k] === "object") {
      (result as Record<string, unknown>)[k] = deepMerge((base as Record<string, unknown>)[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}

export async function loadConfig(opts: { cwd: string }): Promise<QxlConfig> {
  const globalPath = path.join(process.env.HOME ?? "~", ".qxl", "settings.json");
  const projectPath = path.join(opts.cwd, ".qxl", "settings.json");
  const localPath = path.join(opts.cwd, ".qxl", "settings.local.json");

  const [global, project, local] = await Promise.all([
    readJSON(globalPath),
    readJSON(projectPath),
    readJSON(localPath),
  ]);

  return deepMerge(
    deepMerge(
      deepMerge(DEFAULTS as unknown as Record<string, unknown>, global as Record<string, unknown>),
      project as Record<string, unknown>
    ),
    local as Record<string, unknown>
  ) as QxlConfig;
}

import path from "node:path";
import fs from "node:fs/promises";

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function loadMemory(opts: { cwd: string; stopAt?: string }): Promise<string> {
  const sections: string[] = [];
  let dir = path.resolve(opts.cwd);
  const root = opts.stopAt ? path.resolve(opts.stopAt) : "/";
  const visited = new Set<string>();

  while (dir !== path.dirname(dir)) {
    if (visited.has(dir)) break;
    visited.add(dir);
    const candidate = path.join(dir, "QXL.md");
    if (await exists(candidate)) {
      sections.unshift(await fs.readFile(candidate, "utf-8"));
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }

  const globalPath = path.join(process.env.HOME ?? "~", ".qxl", "QXL.md");
  if (!visited.has(path.dirname(globalPath)) && await exists(globalPath)) {
    sections.unshift(await fs.readFile(globalPath, "utf-8"));
  }

  return sections.join("\n\n---\n\n");
}

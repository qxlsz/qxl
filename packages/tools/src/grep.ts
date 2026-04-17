import type { QxlTool } from "./types";
import fs from "node:fs/promises";
import path from "node:path";

async function grepDir(dir: string, regex: RegExp, glob: string | undefined, results: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await grepDir(full, regex, glob, results);
    } else if (entry.isFile()) {
      if (glob && !entry.name.endsWith(glob.replace("*", ""))) continue;
      try {
        const text = await fs.readFile(full, "utf-8");
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push(`${full}:${i + 1}: ${lines[i]}`);
          }
        }
      } catch { /* binary or unreadable, skip */ }
    }
  }
}

export const grepTool: QxlTool = {
  name: "Grep",
  schema: {
    type: "function",
    function: {
      name: "Grep",
      description: "Search for a regex pattern in files recursively.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex pattern to search for." },
          path: { type: "string", description: "Directory or file to search (defaults to cwd)." },
          glob: { type: "string", description: "File extension filter e.g. *.ts" },
        },
        required: ["pattern"],
      },
    },
  },
  async execute(params) {
    const pattern = params.pattern as string;
    const target = (params.path as string | undefined) ?? process.cwd();
    const glob = params.glob as string | undefined;
    let regex: RegExp;
    try { regex = new RegExp(pattern); }
    catch { return { content: `Invalid regex: ${pattern}`, isError: true }; }

    const results: string[] = [];
    await grepDir(target, regex, glob, results);
    if (results.length === 0) return { content: "No matches.", isError: false };
    return { content: results.slice(0, 500).join("\n"), isError: false };
  },
};

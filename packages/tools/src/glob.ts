import type { QxlTool } from "./types";

export const globTool: QxlTool = {
  name: "Glob",
  schema: {
    type: "function",
    function: {
      name: "Glob",
      description: "Find files matching a glob pattern.",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern e.g. **/*.ts" },
          path: { type: "string", description: "Directory to search in (defaults to cwd)." },
        },
        required: ["pattern"],
      },
    },
  },
  async execute(params) {
    const pattern = params.pattern as string;
    const cwd = (params.path as string | undefined) ?? process.cwd();
    const glob = new Bun.Glob(pattern);
    const matches: string[] = [];
    for await (const file of glob.scan({ cwd, absolute: true })) {
      matches.push(file);
    }
    if (matches.length === 0) return { content: "No files matched.", isError: false };
    return { content: matches.join("\n"), isError: false };
  },
};

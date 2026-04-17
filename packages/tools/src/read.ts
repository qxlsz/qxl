import type { QxlTool } from "./types";
import fs from "node:fs/promises";

export const readTool: QxlTool = {
  name: "Read",
  schema: {
    type: "function",
    function: {
      name: "Read",
      description: "Read a file from the filesystem. Supports text and returns lines with numbers.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the file." },
          offset: { type: "number", description: "Line number to start reading from (0-indexed)." },
          limit: { type: "number", description: "Number of lines to read." },
        },
        required: ["file_path"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const lines = content.split("\n");
    const offset = typeof params.offset === "number" ? params.offset : 0;
    const limit = typeof params.limit === "number" ? params.limit : lines.length;
    const slice = lines.slice(offset, offset + limit);

    const numbered = slice
      .map((line, i) => `${String(offset + i + 1).padStart(4, " ")}\t${line}`)
      .join("\n");

    return { content: numbered, isError: false };
  },
};

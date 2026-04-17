import type { QxlTool } from "./types";
import fs from "node:fs/promises";
import path from "node:path";

export const writeTool: QxlTool = {
  name: "Write",
  schema: {
    type: "function",
    function: {
      name: "Write",
      description: "Write content to a file, creating parent directories as needed.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the file." },
          content: { type: "string", description: "Content to write." },
        },
        required: ["file_path", "content"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const content = params.content as string;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    return { content: `Written ${filePath}`, isError: false };
  },
};

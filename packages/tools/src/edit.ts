import type { QxlTool } from "./types";
import fs from "node:fs/promises";

export const editTool: QxlTool = {
  name: "Edit",
  schema: {
    type: "function",
    function: {
      name: "Edit",
      description: "Replace an exact string in a file. Fails if the string appears more than once (use replace_all to override).",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
          replace_all: { type: "boolean", description: "Replace every occurrence." },
        },
        required: ["file_path", "old_string", "new_string"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const oldStr = params.old_string as string;
    const newStr = params.new_string as string;
    const replaceAll = params.replace_all === true;

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return { content: `File not found: ${filePath}`, isError: true };
    }

    const count = content.split(oldStr).length - 1;
    if (count === 0) return { content: `old_string not found in ${filePath}`, isError: true };
    if (count > 1 && !replaceAll) return { content: `old_string matches multiple times (${count}) — set replace_all: true to replace all`, isError: true };

    const updated = replaceAll ? content.replaceAll(oldStr, newStr) : content.replace(oldStr, newStr);
    await fs.writeFile(filePath, updated, "utf-8");
    return { content: `Edited ${filePath} (${count} replacement${count > 1 ? "s" : ""})`, isError: false };
  },
};

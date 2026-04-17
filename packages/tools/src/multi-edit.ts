import type { QxlTool } from "./types";
import fs from "node:fs/promises";

interface Edit { old_string: string; new_string: string; replace_all?: boolean; }

export const multiEditTool: QxlTool = {
  name: "MultiEdit",
  schema: {
    type: "function",
    function: {
      name: "MultiEdit",
      description: "Apply multiple string replacements to a single file atomically.",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                old_string: { type: "string" },
                new_string: { type: "string" },
                replace_all: { type: "boolean" },
              },
              required: ["old_string", "new_string"],
            },
          },
        },
        required: ["file_path", "edits"],
      },
    },
  },
  async execute(params) {
    const filePath = params.file_path as string;
    const edits = params.edits as Edit[];
    let content: string;
    try { content = await fs.readFile(filePath, "utf-8"); }
    catch { return { content: `File not found: ${filePath}`, isError: true }; }

    for (const edit of edits) {
      const count = content.split(edit.old_string).length - 1;
      if (count === 0) return { content: `old_string "${edit.old_string}" not found`, isError: true };
      if (count > 1 && !edit.replace_all) return { content: `old_string "${edit.old_string}" matches ${count} times`, isError: true };
      content = edit.replace_all ? content.replaceAll(edit.old_string, edit.new_string) : content.replace(edit.old_string, edit.new_string);
    }

    await fs.writeFile(filePath, content, "utf-8");
    return { content: `Applied ${edits.length} edit(s) to ${filePath}`, isError: false };
  },
};

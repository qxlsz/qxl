import type { Tool } from "./gateway";

export const READ_FILE_TOOL: Tool = {
  type: "function",
  function: {
    name: "read_file",
    description: "Read the text contents of a file at a given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative or absolute path to the file" },
      },
      required: ["path"],
    },
  },
};

export const ALL_TOOLS: Tool[] = [READ_FILE_TOOL];

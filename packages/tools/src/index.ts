export { readTool } from "./read";
export { writeTool } from "./write";
export { editTool } from "./edit";
export { multiEditTool } from "./multi-edit";
export { globTool } from "./glob";
export { grepTool } from "./grep";
export { ToolRegistry } from "./registry";
export type { QxlTool, ToolResult } from "./types";

import { ToolRegistry } from "./registry";
import { readTool } from "./read";
import { writeTool } from "./write";
import { editTool } from "./edit";
import { multiEditTool } from "./multi-edit";
import { globTool } from "./glob";
import { grepTool } from "./grep";

export const defaultRegistry = new ToolRegistry()
  .register(readTool)
  .register(writeTool)
  .register(editTool)
  .register(multiEditTool)
  .register(globTool)
  .register(grepTool);

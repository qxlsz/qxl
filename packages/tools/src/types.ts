import type { Tool as GatewayTool } from "@qxl/gateway";

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface QxlTool {
  name: string;
  schema: GatewayTool;
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

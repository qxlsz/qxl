import type { QxlTool, ToolResult } from "./types";
import type { Tool as GatewayTool } from "@qxl/gateway";

export class ToolRegistry {
  private tools = new Map<string, QxlTool>();

  register(tool: QxlTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): QxlTool | undefined {
    return this.tools.get(name);
  }

  schemas(): GatewayTool[] {
    return [...this.tools.values()].map((t) => t.schema);
  }

  async execute(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { content: `Unknown tool: ${name}`, isError: true };
    try {
      return await tool.execute(params);
    } catch (err) {
      return { content: `Tool error: ${(err as Error).message}`, isError: true };
    }
  }
}

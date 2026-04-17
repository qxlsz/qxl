import type { Message } from "@qxl/gateway";
import type { ToolRegistry } from "@qxl/tools";

export type { Message };

export interface AgentOptions {
  prompt: string;
  sessionId?: string;
  baseURL: string;
  model: string;
  cwd: string;
  registry: ToolRegistry;
  cancelled?: () => boolean;
}

export type AgentEvent =
  | { type: "session_id"; id: string }
  | { type: "token"; delta: string }
  | { type: "tool_start"; callId: string; name: string; params: string }
  | { type: "tool_result"; callId: string; content: string; isError: boolean }
  | { type: "turn_end"; stopReason: string }
  | { type: "done" };

export interface SessionData {
  id: string;
  cwd: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

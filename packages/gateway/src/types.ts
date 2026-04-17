import type OpenAI from "openai";

export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;
export type Tool = OpenAI.Chat.Completions.ChatCompletionTool;
export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type GatewayEvent =
  | { type: "token"; delta: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; stopReason: string };

export interface StreamRequest {
  messages: Message[];
  tools?: Tool[];
  system?: string;
}

export interface GatewayOptions {
  baseURL: string;
  model: string;
  apiKey?: string;
}

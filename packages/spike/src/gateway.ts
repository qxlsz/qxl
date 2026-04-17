import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

export type Tool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

export interface StreamOptions {
  baseURL: string;
  model: string;
  messages: ChatCompletionMessageParam[];
  tools?: Tool[];
  onToken: (delta: string) => void;
  onToolCall: (call: ToolCall) => void;
  onDone: (stopReason: string) => void;
}

export async function streamCompletion(
  opts: Omit<StreamOptions, "onToolCall"> & { onToolCall?: StreamOptions["onToolCall"] }
): Promise<void> {
  const client = new OpenAI({ baseURL: opts.baseURL, apiKey: "local" });

  const stream = await client.chat.completions.create({
    model: opts.model,
    messages: opts.messages,
    tools: opts.tools,
    tool_choice: opts.tools?.length ? "auto" : undefined,
    stream: true,
  });

  const pendingCalls = new Map<number, { id: string; name: string; args: string }>();

  for await (const chunk of stream) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    const delta = choice.delta;

    if (delta.content) {
      opts.onToken(delta.content);
    }

    for (const tc of delta.tool_calls ?? []) {
      const idx = tc.index;
      if (!pendingCalls.has(idx)) {
        pendingCalls.set(idx, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
      }
      const pending = pendingCalls.get(idx)!;
      if (tc.id) pending.id = tc.id;
      if (tc.function?.name) pending.name = tc.function.name;
      if (tc.function?.arguments) pending.args += tc.function.arguments;
    }

    if (choice.finish_reason) {
      for (const [, call] of pendingCalls) {
        opts.onToolCall?.({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.args },
        });
      }
      opts.onDone(choice.finish_reason);
    }
  }
}

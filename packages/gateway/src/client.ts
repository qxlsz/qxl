import OpenAI from "openai";
import type { GatewayEvent, GatewayOptions, StreamRequest } from "./types";

export class GatewayClient {
  private client: OpenAI;
  constructor(private opts: GatewayOptions) {
    this.client = new OpenAI({ baseURL: opts.baseURL, apiKey: opts.apiKey ?? "local" });
  }

  get model(): string { return this.opts.model; }

  async *stream(req: StreamRequest): AsyncGenerator<GatewayEvent> {
    const messages = req.system
      ? [{ role: "system" as const, content: req.system }, ...req.messages]
      : req.messages;

    const stream = await this.client.chat.completions.create({
      model: this.opts.model,
      messages,
      tools: req.tools,
      tool_choice: req.tools?.length ? "auto" : undefined,
      stream: true,
    });

    const pending = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta.content) yield { type: "token", delta: delta.content };

      for (const tc of delta.tool_calls ?? []) {
        if (!pending.has(tc.index)) {
          pending.set(tc.index, { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" });
        }
        const p = pending.get(tc.index)!;
        if (tc.id) p.id = tc.id;
        if (tc.function?.name) p.name = tc.function.name;
        if (tc.function?.arguments) p.args += tc.function.arguments;
      }

      if (choice.finish_reason) {
        for (const [, c] of pending) {
          yield { type: "tool_call", call: { id: c.id, type: "function", function: { name: c.name, arguments: c.args } } };
        }
        yield { type: "done", stopReason: choice.finish_reason };
      }
    }
  }
}

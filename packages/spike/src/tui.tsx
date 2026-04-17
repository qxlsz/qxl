import React, { useState, useEffect } from "react";
import { Box, Text, render as inkRender } from "ink";
import type { StreamOptions } from "./gateway";

interface StreamOutputProps {
  tokens: string[];
  done: boolean;
  toolCalls?: Array<{ name: string; args: string }>;
}

export function StreamOutput({ tokens, done, toolCalls = [] }: StreamOutputProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Text color="cyan" bold>qxl</Text>
        <Text>{tokens.join("")}</Text>
        {toolCalls.map((tc, i) => (
          <Box key={i} marginTop={1} flexDirection="column">
            <Text color="yellow">Tool: {tc.name}</Text>
            <Text dimColor>{tc.args}</Text>
          </Box>
        ))}
        {done && <Text color="green" dimColor>Done</Text>}
      </Box>
    </Box>
  );
}

export interface AppProps {
  baseURL: string;
  model: string;
  prompt: string;
}

export function App({ baseURL, model, prompt }: AppProps) {
  const [tokens, setTokens] = useState<string[]>([]);
  const [toolCalls, setToolCalls] = useState<Array<{ name: string; args: string }>>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    import("./gateway").then(({ streamCompletion }) => {
      import("./tools").then(({ ALL_TOOLS }) => {
        streamCompletion({
          baseURL,
          model,
          messages: [{ role: "user", content: prompt }],
          tools: ALL_TOOLS,
          onToken: (t) => setTokens((prev) => [...prev, t]),
          onToolCall: (tc) => setToolCalls((prev) => [...prev, { name: tc.function.name, args: tc.function.arguments }]),
          onDone: () => setDone(true),
        });
      });
    });
  }, []);

  return <StreamOutput tokens={tokens} done={done} toolCalls={toolCalls} />;
}

export function runApp(opts: AppProps) {
  inkRender(<App {...opts} />);
}

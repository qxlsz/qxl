import React from "react";
import { Box, Text } from "ink";
import type { Message } from "@qxl/core";

interface Props {
  messages: Message[];
  streamingDelta: string;
  generating?: boolean;
}

export function Transcript({ messages, streamingDelta, generating }: Props) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, i) => {
        const m = msg as Record<string, unknown>;
        if (m.role === "tool") return null;
        const content = typeof m.content === "string" ? m.content : "";
        if (!content) return null;
        const isUser = m.role === "user";
        return (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text color={isUser ? "green" : "cyan"} bold>
              {isUser ? "you" : "qxl"}
            </Text>
            <Box paddingLeft={2}>
              <Text wrap="wrap">{content}</Text>
            </Box>
          </Box>
        );
      })}

      {(streamingDelta || generating) && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>qxl</Text>
          <Box paddingLeft={2}>
            {streamingDelta ? (
              <Text wrap="wrap">{streamingDelta}<Text color="cyan">▋</Text></Text>
            ) : (
              <Text dimColor>thinking…</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

import React from "react";
import { Box, Text } from "ink";
import type { Message } from "@qxl/core";

interface Props {
  messages: Message[];
  streamingDelta: string;
}

export function Transcript({ messages, streamingDelta }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => {
        const m = msg as Record<string, unknown>;
        if (m.role === "tool") return null;
        const content = typeof m.content === "string" ? m.content : "";
        const color = m.role === "user" ? "green" : "white";
        const label = m.role === "user" ? "You" : "qxl";
        if (!content) return null;
        return (
          <Box key={i} flexDirection="column" marginBottom={1}>
            <Text color={color} bold>{label}</Text>
            <Text>{content}</Text>
          </Box>
        );
      })}
      {streamingDelta && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="white" bold>qxl</Text>
          <Text>{streamingDelta}</Text>
        </Box>
      )}
    </Box>
  );
}

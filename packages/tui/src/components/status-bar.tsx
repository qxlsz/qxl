import React from "react";
import { Box, Text } from "ink";

interface Props {
  model: string;
  tokens: number;
  turn: number;
  elapsedMs: number;
}

export function StatusBar({ model, tokens, turn, elapsedMs }: Props) {
  const elapsed = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text dimColor>{model} · turn {turn} · {tokens} tokens · {elapsed}</Text>
    </Box>
  );
}

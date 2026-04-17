import React from "react";
import { Box, Text } from "ink";

interface Props {
  model: string;
  tokens: number;
  turn: number;
  elapsedMs: number;
  busy?: boolean;
}

function shortModel(id: string): string {
  // "mlx-community/Qwen3.6-35B-A3B-4bit-DWQ" → "Qwen3.6-35B"
  const name = id.split("/").pop() ?? id;
  return name.length > 30 ? name.slice(0, 30) + "…" : name;
}

export function StatusBar({ model, tokens, turn, elapsedMs, busy }: Props) {
  const elapsed = elapsedMs < 1000 ? `${elapsedMs}ms` : `${(elapsedMs / 1000).toFixed(1)}s`;
  const tps = elapsedMs > 500 && tokens > 0 ? ` · ${(tokens / (elapsedMs / 1000)).toFixed(1)} tok/s` : "";

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Text dimColor>{shortModel(model)}</Text>
      <Text dimColor>
        {busy ? "● " : "○ "}
        turn {turn} · {tokens} tok{tps} · {elapsed}
      </Text>
      <Text dimColor>esc {busy ? "cancel" : "quit"}</Text>
    </Box>
  );
}

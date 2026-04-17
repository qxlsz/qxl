import React from "react";
import { Box, Text } from "ink";

interface Props {
  name: string;
  params: string;
  result?: string;
  isError: boolean;
}

export function ToolCard({ name, params, result, isError }: Props) {
  let paramDisplay = params;
  try {
    const p = JSON.parse(params);
    paramDisplay = Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(", ");
  } catch {}

  return (
    <Box borderStyle="single" borderColor={isError ? "red" : "yellow"} flexDirection="column" paddingX={1} marginBottom={1}>
      <Text color="yellow" bold>⚙ {name}</Text>
      <Text dimColor>{paramDisplay}</Text>
      {result && <Text color={isError ? "red" : "white"}>{result.slice(0, 200)}{result.length > 200 ? "…" : ""}</Text>}
    </Box>
  );
}

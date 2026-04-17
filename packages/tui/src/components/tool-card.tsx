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
    const p = JSON.parse(params) as Record<string, unknown>;
    const entries = Object.entries(p);
    paramDisplay = entries.map(([k, v]) => `${k}: ${String(v)}`).join("  ");
  } catch {}

  const done = result !== undefined;
  const icon = done ? (isError ? "✗" : "✓") : "…";
  const iconColor = done ? (isError ? "red" : "green") : "yellow";
  const borderColor = isError ? "red" : done ? "green" : "yellow";

  return (
    <Box
      borderStyle="single"
      borderColor={borderColor}
      flexDirection="column"
      paddingX={1}
      marginBottom={1}
    >
      <Box gap={1}>
        <Text color={iconColor} bold>{icon}</Text>
        <Text color="yellow" bold>{name}</Text>
        <Text dimColor>{paramDisplay.slice(0, 80)}{paramDisplay.length > 80 ? "…" : ""}</Text>
      </Box>
      {result && (
        <Box paddingLeft={2} marginTop={0}>
          <Text color={isError ? "red" : "white"} dimColor={!isError}>
            {result.slice(0, 300)}{result.length > 300 ? "\n…" : ""}
          </Text>
        </Box>
      )}
    </Box>
  );
}

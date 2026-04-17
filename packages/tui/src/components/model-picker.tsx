import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelEntry } from "@qxl/core";

interface Props {
  models: ModelEntry[];
  onSelect: (model: ModelEntry) => void;
}

export function ModelPicker({ models, onSelect }: Props) {
  const [index, setIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setIndex((i) => Math.min(models.length - 1, i + 1));
    if (key.return) onSelect(models[index]);
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold color="cyan">  qxl — choose a model</Text>
      <Text dimColor>  ↑↓ navigate  ↵ select</Text>
      <Box flexDirection="column" marginTop={1}>
        {models.map((m, i) => (
          <Box key={m.id}>
            <Text color={i === index ? "green" : "white"} bold={i === index}>
              {i === index ? "▶ " : "  "}
            </Text>
            <Text color={i === index ? "green" : "white"} bold={i === index}>
              {m.label}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>  {models[index]?.id}</Text>
      </Box>
    </Box>
  );
}

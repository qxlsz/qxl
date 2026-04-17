import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ModelEntry } from "@qxl/core";

interface Props {
  models: ModelEntry[];
  onSelect: (model: ModelEntry) => void;
}

export function ModelPicker({ models, onSelect }: Props) {
  const [index, setIndex] = useState(0);
  const { exit } = useApp();

  useInput((_input, key) => {
    if (key.upArrow) setIndex((i) => Math.max(0, i - 1));
    if (key.downArrow) setIndex((i) => Math.min(models.length - 1, i + 1));
    if (key.return) onSelect(models[index]);
    if (_input === "q") exit();
  });

  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      <Box marginBottom={1}>
        <Text bold color="cyan">qxl</Text>
        <Text color="white" dimColor> — choose a model</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {models.map((m, i) => {
          const selected = i === index;
          return (
            <Box key={m.id} paddingY={0}>
              <Text color={selected ? "green" : "gray"} bold={selected}>
                {selected ? "▶ " : "  "}
              </Text>
              <Text color={selected ? "green" : "white"} bold={selected}>
                {m.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
        <Text dimColor>{models[index]?.id ?? ""}</Text>
      </Box>

      <Text dimColor>  ↑ ↓ navigate   ↵ select   q quit</Text>
    </Box>
  );
}

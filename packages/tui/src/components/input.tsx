import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function Input({ onSubmit, onCancel, disabled, placeholder = "ask anything…" }: Props) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.escape) { onCancel(); return; }
    if (disabled) return;
    if (key.return) {
      if (value.trim()) { onSubmit(value.trim()); setValue(""); }
      return;
    }
    if (key.backspace || key.delete) { setValue((v) => v.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && input) { setValue((v) => v + input); }
  });

  const showPlaceholder = !disabled && value === "";

  return (
    <Box borderStyle="round" borderColor={disabled ? "gray" : "green"} paddingX={1}>
      <Text color={disabled ? "gray" : "green"}>{"› "}</Text>
      {showPlaceholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : (
        <Text>{value}{!disabled && <Text color="green">▋</Text>}</Text>
      )}
    </Box>
  );
}

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function Input({ onSubmit, onCancel, disabled }: Props) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (disabled) return;
    if (key.escape) { onCancel(); return; }
    if (key.return) {
      if (value.trim()) { onSubmit(value.trim()); setValue(""); }
      return;
    }
    if (key.backspace || key.delete) { setValue((v) => v.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta) { setValue((v) => v + input); }
  });

  return (
    <Box borderStyle="round" borderColor={disabled ? "gray" : "green"} paddingX={1}>
      <Text color={disabled ? "gray" : "green"}>{">"} </Text>
      <Text>{value}</Text>
      <Text color="green">{disabled ? "" : "▋"}</Text>
    </Box>
  );
}

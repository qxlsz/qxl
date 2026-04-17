import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useApp } from "ink";
import { agentLoop, loadConfig } from "@qxl/core";
import { defaultRegistry } from "@qxl/tools";
import type { AgentEvent, Message, ModelEntry } from "@qxl/core";
import { Transcript } from "./components/transcript";
import { ToolCard } from "./components/tool-card";
import { StatusBar } from "./components/status-bar";
import { Input } from "./components/input";
import { ModelPicker } from "./components/model-picker";

interface ToolCardData { callId: string; name: string; params: string; result?: string; isError: boolean; }

interface AppProps {
  initialPrompt?: string;
  sessionId?: string;
  cwd: string;
  forceModel?: string;
}

export function App({ initialPrompt, sessionId, cwd, forceModel }: AppProps) {
  const { exit } = useApp();
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(forceModel ?? null);
  const [baseURL, setBaseURL] = useState("http://127.0.0.1:8090/v1");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingDelta, setStreamingDelta] = useState("");
  const [toolCards, setToolCards] = useState<ToolCardData[]>([]);
  const [tokens, setTokens] = useState(0);
  const [turn, setTurn] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    loadConfig({ cwd }).then((cfg) => {
      setModels(cfg.models);
      setBaseURL(cfg.baseURL);
    });
  }, []);

  const runAgent = useCallback(async (prompt: string, model: string, sid?: string) => {
    cancelledRef.current = false;
    setBusy(true);
    setStreamingDelta("");
    setToolCards([]);
    startRef.current = Date.now();

    const loop = agentLoop({
      prompt,
      sessionId: sid,
      baseURL,
      model,
      cwd,
      registry: defaultRegistry,
      cancelled: () => cancelledRef.current,
    });

    let delta = "";
    for await (const event of loop) {
      setElapsed(Date.now() - startRef.current);
      if (event.type === "token") {
        delta += event.delta;
        setStreamingDelta(delta);
        setTokens((t) => t + 1);
      }
      if (event.type === "tool_start") {
        setToolCards((prev) => [...prev, { callId: event.callId, name: event.name, params: event.params, isError: false }]);
      }
      if (event.type === "tool_result") {
        setToolCards((prev) => prev.map((c) => c.callId === event.callId ? { ...c, result: event.content, isError: event.isError } : c));
      }
      if (event.type === "turn_end") {
        if (delta) {
          setMessages((prev) => [...prev, { role: "assistant", content: delta } as Message]);
          delta = "";
          setStreamingDelta("");
        }
        setTurn((t) => t + 1);
      }
      if (event.type === "done") break;
    }
    setBusy(false);
  }, [cwd, baseURL]);

  const handleModelSelect = useCallback((entry: ModelEntry) => {
    setActiveModel(entry.id);
    if (initialPrompt) {
      setMessages([{ role: "user", content: initialPrompt } as Message]);
      runAgent(initialPrompt, entry.id, sessionId);
    }
  }, [initialPrompt, sessionId, runAgent]);

  useEffect(() => {
    if (forceModel && initialPrompt) {
      setMessages([{ role: "user", content: initialPrompt } as Message]);
      runAgent(initialPrompt, forceModel, sessionId);
    }
  }, [forceModel]);

  const handleSubmit = useCallback((text: string) => {
    if (!activeModel) return;
    setMessages((prev) => [...prev, { role: "user", content: text } as Message]);
    runAgent(text, activeModel);
  }, [activeModel, runAgent]);

  const handleCancel = useCallback(() => {
    if (busy) {
      cancelledRef.current = true;
    } else {
      exit();
    }
  }, [busy, exit]);

  // Show model picker if no model selected yet
  if (!activeModel && models.length > 0) {
    return <ModelPicker models={models} onSelect={handleModelSelect} />;
  }

  // Loading config
  if (!activeModel) {
    return <Box><StatusBar model="loading…" tokens={0} turn={0} elapsedMs={0} /></Box>;
  }

  return (
    <Box flexDirection="column" height="100%">
      <Transcript messages={messages} streamingDelta={streamingDelta} />
      {toolCards.map((tc, i) => (
        <ToolCard key={i} name={tc.name} params={tc.params} result={tc.result} isError={tc.isError} />
      ))}
      <StatusBar model={activeModel} tokens={tokens} turn={turn} elapsedMs={elapsed} />
      <Input onSubmit={handleSubmit} onCancel={handleCancel} disabled={busy} />
    </Box>
  );
}

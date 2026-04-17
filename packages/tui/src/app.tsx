import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useApp } from "ink";
import { agentLoop, loadConfig, mlxServer } from "@qxl/core";
import { defaultRegistry } from "@qxl/tools";
import type { AgentEvent, Message, ModelEntry } from "@qxl/core";
import { Transcript } from "./components/transcript";
import { ToolCard } from "./components/tool-card";
import { StatusBar } from "./components/status-bar";
import { Input } from "./components/input";
import { ModelPicker } from "./components/model-picker";

interface ToolCardData { callId: string; name: string; params: string; result?: string; isError: boolean; }

type Phase = "loading-config" | "picking-model" | "starting-server" | "ready" | "error";

interface AppProps {
  initialPrompt?: string;
  sessionId?: string;
  cwd: string;
  forceModel?: string;
}

export function App({ initialPrompt, sessionId, cwd, forceModel }: AppProps) {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading-config");
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [activeModel, setActiveModel] = useState<string>(forceModel ?? "");
  const [serverError, setServerError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingDelta, setStreamingDelta] = useState("");
  const [toolCards, setToolCards] = useState<ToolCardData[]>([]);
  const [tokens, setTokens] = useState(0);
  const [turn, setTurn] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);
  const busyRef = useRef(false);
  const startRef = useRef(Date.now());
  const didInit = useRef(false);

  // Load config on mount
  useEffect(() => {
    loadConfig({ cwd }).then((cfg) => {
      setModels(cfg.models);
      if (forceModel) {
        startServer(forceModel);
      } else {
        setPhase("picking-model");
      }
    });

    // Cleanup: stop server when app exits
    return () => { mlxServer.stop(); };
  }, []);

  const startServer = useCallback(async (model: string) => {
    setActiveModel(model);
    setPhase("starting-server");
    try {
      await mlxServer.start(model);
      setPhase("ready");
      // If there's an initial prompt, kick off the agent immediately
      if (initialPrompt && !didInit.current) {
        didInit.current = true;
        setMessages([{ role: "user", content: initialPrompt } as Message]);
        runAgent(initialPrompt, model, sessionId);
      }
    } catch (err) {
      setServerError((err as Error).message);
      setPhase("error");
    }
  }, [initialPrompt, sessionId]);

  const runAgent = useCallback(async (prompt: string, model: string, sid?: string) => {
    cancelledRef.current = false;
    busyRef.current = true;
    setBusy(true);
    setStreamingDelta("");
    setToolCards([]);
    startRef.current = Date.now();

    const loop = agentLoop({
      prompt,
      sessionId: sid,
      baseURL: mlxServer.baseURL,
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
    busyRef.current = false;
    setBusy(false);
  }, [cwd]);

  const handleModelSelect = useCallback((entry: ModelEntry) => {
    startServer(entry.id);
  }, [startServer]);

  const handleSubmit = useCallback((text: string) => {
    if (!activeModel) return;
    setMessages((prev) => [...prev, { role: "user", content: text } as Message]);
    runAgent(text, activeModel);
  }, [activeModel, runAgent]);

  const handleCancel = useCallback(() => {
    if (busyRef.current) {
      cancelledRef.current = true;
    } else {
      mlxServer.stop();
      exit();
    }
  }, [exit]);

  // --- Render phases ---

  if (phase === "loading-config") {
    return <Box><Text dimColor>Loading config…</Text></Box>;
  }

  if (phase === "picking-model") {
    return <ModelPicker models={models} onSelect={handleModelSelect} />;
  }

  if (phase === "starting-server") {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="cyan" bold>  Starting MLX server…</Text>
        <Text dimColor>  Model: {activeModel}</Text>
        <Text dimColor>  This may take a minute while the model loads into memory.</Text>
        <Text dimColor>  First run with a new model will also download weights.</Text>
      </Box>
    );
  }

  if (phase === "error") {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="red" bold>  Failed to start MLX server</Text>
        <Text color="red">{serverError}</Text>
        <Text dimColor>  Ensure mlx_lm is installed: source .venv/bin/activate && pip install mlx-lm</Text>
        <Text dimColor>  Or set QXL_PYTHON to your Python 3.12 executable.</Text>
      </Box>
    );
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

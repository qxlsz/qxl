import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useApp } from "ink";
import { agentLoop, loadConfig, mlxServer } from "@qxl/core";
import { defaultRegistry } from "@qxl/tools";
import type { Message, ModelEntry } from "@qxl/core";
import { Transcript } from "./components/transcript";
import { ToolCard } from "./components/tool-card";
import { StatusBar } from "./components/status-bar";
import { Input } from "./components/input";
import { ModelPicker } from "./components/model-picker";
import { Spinner } from "./components/spinner";

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
  const [generating, setGenerating] = useState(false);
  const cancelledRef = useRef(false);
  const busyRef = useRef(false);
  const startRef = useRef(Date.now());
  const didInit = useRef(false);

  useEffect(() => {
    loadConfig({ cwd }).then((cfg) => {
      setModels(cfg.models);
      if (forceModel) {
        startServer(forceModel);
      } else {
        setPhase("picking-model");
      }
    });
    return () => { mlxServer.stop(); };
  }, []);

  const startServer = useCallback(async (model: string) => {
    setActiveModel(model);
    setPhase("starting-server");
    try {
      await mlxServer.start(model);
      setPhase("ready");
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
    setGenerating(true);
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
        setGenerating(false);
        delta += event.delta;
        setStreamingDelta(delta);
        setTokens((t) => t + 1);
      }
      if (event.type === "tool_start") {
        setToolCards((prev) => [...prev, { callId: event.callId, name: event.name, params: event.params, isError: false }]);
        setGenerating(false);
        setStreamingDelta("");
        delta = "";
      }
      if (event.type === "tool_result") {
        setToolCards((prev) => prev.map((c) => c.callId === event.callId ? { ...c, result: event.content, isError: event.isError } : c));
        setGenerating(true);
      }
      if (event.type === "turn_end") {
        if (delta) {
          setMessages((prev) => [...prev, { role: "assistant", content: delta } as Message]);
          delta = "";
          setStreamingDelta("");
        }
        setTurn((t) => t + 1);
        setGenerating(false);
      }
      if (event.type === "done") break;
    }

    busyRef.current = false;
    setBusy(false);
    setGenerating(false);
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

  if (phase === "loading-config") {
    return (
      <Box paddingX={2} paddingY={1}>
        <Spinner label="Loading config…" />
      </Box>
    );
  }

  if (phase === "picking-model") {
    return <ModelPicker models={models} onSelect={handleModelSelect} />;
  }

  if (phase === "starting-server") {
    const shortName = activeModel.split("/").pop() ?? activeModel;
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Spinner label={`Starting ${shortName}…`} />
        <Box marginTop={1}>
          <Text dimColor>Loading weights into memory. First run may download the model.</Text>
        </Box>
      </Box>
    );
  }

  if (phase === "error") {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="red" bold>✗ Failed to start MLX server</Text>
        <Box marginTop={1}>
          <Text color="red">{serverError}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>• Is mlx_lm installed? Run: source .venv/bin/activate && pip install mlx-lm</Text>
          <Text dimColor>• Set QXL_PYTHON=/path/to/python3.12 to override the Python executable</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Transcript messages={messages} streamingDelta={streamingDelta} generating={generating} />
      {toolCards.map((tc, i) => (
        <ToolCard key={i} name={tc.name} params={tc.params} result={tc.result} isError={tc.isError} />
      ))}
      <StatusBar model={activeModel} tokens={tokens} turn={turn} elapsedMs={elapsed} busy={busy} />
      <Input onSubmit={handleSubmit} onCancel={handleCancel} disabled={busy} />
    </Box>
  );
}

import React from "react";
import { render } from "ink";
import { App } from "./app";

export interface RunTUIOptions {
  initialPrompt?: string;
  sessionId?: string;
  cwd?: string;
}

export function runTUI(opts: RunTUIOptions = {}): void {
  render(
    <App
      initialPrompt={opts.initialPrompt}
      sessionId={opts.sessionId}
      cwd={opts.cwd ?? process.cwd()}
    />,
    { exitOnCtrlC: false }
  );
}

export { App };

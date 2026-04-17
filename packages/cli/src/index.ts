#!/usr/bin/env bun
import { Command } from "commander";
import { runTUI } from "@qxl/tui";
import { Session } from "@qxl/core";
import path from "node:path";
import os from "node:os";

const DB_PATH = path.join(os.homedir(), ".qxl", "sessions.db");

const program = new Command("qxl")
  .version("0.1.0")
  .description("Local-first agentic coding CLI")
  .argument("[prompt...]", "Prompt to send")
  .option("-c, --continue", "Continue the last session in cwd")
  .option("-r, --resume <id>", "Resume session by ID")
  .option("--model <model>", "Override the model")
  .action((promptParts: string[], opts: { continue?: boolean; resume?: string; model?: string }) => {
    const prompt = promptParts.join(" ") || undefined;
    if (opts.model) process.env.QXL_MODEL = opts.model;
    let sessionId = opts.resume;
    if (opts.continue && !sessionId) {
      const cwd = process.cwd();
      const list = Session.list({ dbPath: DB_PATH });
      const last = list.find((s) => s.cwd === cwd);
      if (last) sessionId = last.id;
    }
    runTUI({ initialPrompt: prompt, sessionId });
  });

program
  .command("sessions")
  .description("List recent sessions")
  .action(() => {
    const list = Session.list({ dbPath: DB_PATH });
    if (list.length === 0) { console.log("No sessions found."); return; }
    for (const s of list.slice(0, 20)) {
      console.log(`${s.id.slice(0, 8)}  ${new Date(s.updatedAt).toLocaleString()}  ${s.cwd}`);
    }
  });

program.parse(process.argv);

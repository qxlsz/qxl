#!/usr/bin/env bun
import { runApp } from "./tui";

const BASE_URL = process.env.QXL_BASE_URL ?? "http://127.0.0.1:8090/v1";
const MODEL = process.env.QXL_MODEL ?? "mlx-community/Qwen2.5-Coder-7B-Instruct-4bit";
const PROMPT = process.argv.slice(2).join(" ") || "Read the file at ./package.json using the read_file tool.";

runApp({ baseURL: BASE_URL, model: MODEL, prompt: PROMPT });

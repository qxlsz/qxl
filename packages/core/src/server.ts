import path from "node:path";
import fs from "node:fs/promises";

export class MLXServer {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  readonly port: number;
  private currentModel: string | null = null;

  constructor(port = 8090) {
    this.port = port;
  }

  get baseURL(): string {
    return `http://127.0.0.1:${this.port}/v1`;
  }

  async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/v1/models`, {
        signal: AbortSignal.timeout(800),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async start(model: string): Promise<void> {
    // If server is already running with the same model, reuse it
    if (this.proc && this.currentModel === model && await this.isRunning()) return;

    // If an external server is already running, use it (don't spawn a new one)
    if (!this.proc && await this.isRunning()) {
      this.currentModel = model;
      return;
    }

    // Stop any existing process (model change)
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
      this.currentModel = null;
      // Give it a moment to release the port
      await Bun.sleep(1000);
    }

    const python = await this.findPython();

    this.proc = Bun.spawn(
      [python, "-m", "mlx_lm.server", "--model", model, "--port", String(this.port), "--host", "127.0.0.1"],
      { stdout: "ignore", stderr: "ignore" }
    );

    this.currentModel = model;
    await this.waitReady(180_000);
  }

  async waitReady(timeoutMs = 180_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isRunning()) return;
      await Bun.sleep(500);
    }
    throw new Error(`MLX server did not become ready within ${timeoutMs / 1000}s. Is mlx_lm installed in .venv/?`);
  }

  stop(): void {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
      this.currentModel = null;
    }
  }

  private async findPython(): Promise<string> {
    // 1. Explicit override
    if (process.env.QXL_PYTHON) return process.env.QXL_PYTHON;

    // 2. Walk up from cwd looking for .venv/bin/python3
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, ".venv", "bin", "python3");
      try {
        await fs.access(candidate);
        return candidate;
      } catch {}
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // 3. Fall back to system python3
    return "python3";
  }
}

// Singleton for use in TUI
export const mlxServer = new MLXServer(8090);

import { Database } from "bun:sqlite";
import type { Message, SessionData } from "./types";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    name TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`;

function openDB(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  db.exec(SCHEMA);
  return db;
}

function rowToMessage(row: Record<string, unknown>): Message {
  const base = { role: row.role as string };
  const content = row.content as string | null;
  const toolCalls = row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined;
  const toolCallId = row.tool_call_id as string | null;
  if (toolCallId) return { ...base, role: "tool", tool_call_id: toolCallId, content: content ?? "" } as Message;
  if (toolCalls) return { ...base, role: "assistant", content: content ?? null, tool_calls: toolCalls } as Message;
  return { ...base, content: content ?? "" } as Message;
}

export class Session {
  readonly id: string;
  readonly cwd: string;
  readonly model: string;
  readonly createdAt: number;
  messages: Message[];
  private updatedAt: number;

  private constructor(data: SessionData) {
    this.id = data.id;
    this.cwd = data.cwd;
    this.model = data.model;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.messages = data.messages;
  }

  static create(opts: { dbPath: string; cwd: string; model: string }): Session {
    const id = crypto.randomUUID();
    const now = Date.now();
    return new Session({ id, cwd: opts.cwd, model: opts.model, createdAt: now, updatedAt: now, messages: [] });
  }

  static resume(opts: { dbPath: string; id: string }): Session | null {
    const db = openDB(opts.dbPath);
    const row = db.query("SELECT * FROM sessions WHERE id = ?").get(opts.id) as Record<string, unknown> | null;
    if (!row) return null;
    const msgRows = db.query("SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC").all(opts.id) as Record<string, unknown>[];
    return new Session({
      id: row.id as string,
      cwd: row.cwd as string,
      model: row.model as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      messages: msgRows.map(rowToMessage),
    });
  }

  static list(opts: { dbPath: string }): Array<{ id: string; cwd: string; updatedAt: number }> {
    const db = openDB(opts.dbPath);
    const rows = db.query("SELECT id, cwd, updated_at FROM sessions ORDER BY updated_at DESC").all() as Record<string, unknown>[];
    return rows.map((r) => ({ id: r.id as string, cwd: r.cwd as string, updatedAt: r.updated_at as number }));
  }

  addMessage(msg: Message): void {
    this.messages.push(msg);
  }

  async save(dbPath: string): Promise<void> {
    const db = openDB(dbPath);
    // Ensure updated_at is strictly greater than any existing session's updated_at
    // to guarantee correct ordering even when saves happen within the same millisecond
    const maxRow = db.query("SELECT MAX(updated_at) as max_ts FROM sessions").get() as { max_ts: number | null } | null;
    const maxTs = maxRow?.max_ts ?? 0;
    this.updatedAt = Math.max(Date.now(), maxTs + 1);
    db.run(
      "INSERT OR REPLACE INTO sessions (id, cwd, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [this.id, this.cwd, this.model, this.createdAt, this.updatedAt]
    );
    db.run("DELETE FROM messages WHERE session_id = ?", [this.id]);
    const insert = db.prepare(
      "INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const now = Date.now();
    for (const msg of this.messages) {
      const m = msg as Record<string, unknown>;
      insert.run(
        this.id,
        m.role,
        typeof m.content === "string" ? m.content : null,
        m.tool_calls ? JSON.stringify(m.tool_calls) : null,
        m.tool_call_id ?? null,
        m.name ?? null,
        now
      );
    }
  }
}

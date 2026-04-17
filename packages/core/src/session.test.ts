import { expect, test, afterEach } from "bun:test";
import { Session } from "./session";
import path from "node:path";
import fs from "node:fs/promises";

const DB_PATH = path.join(import.meta.dir, "__session_test__.db");

afterEach(async () => {
  try { await fs.unlink(DB_PATH); } catch {}
});

test("creates a new session and persists messages", async () => {
  const s = Session.create({ dbPath: DB_PATH, cwd: "/tmp", model: "test-model" });
  s.addMessage({ role: "user", content: "hello" });
  s.addMessage({ role: "assistant", content: "world" });
  await s.save(DB_PATH);

  const loaded = Session.resume({ dbPath: DB_PATH, id: s.id });
  expect(loaded).not.toBeNull();
  expect(loaded!.messages).toHaveLength(2);
  expect((loaded!.messages[0] as { content: string }).content).toBe("hello");
});

test("returns null when session id not found", () => {
  const result = Session.resume({ dbPath: DB_PATH, id: "nonexistent" });
  expect(result).toBeNull();
});

test("lists sessions ordered by updated_at desc", async () => {
  const s1 = Session.create({ dbPath: DB_PATH, cwd: "/a", model: "m" });
  await s1.save(DB_PATH);
  const s2 = Session.create({ dbPath: DB_PATH, cwd: "/b", model: "m" });
  await s2.save(DB_PATH);

  const list = Session.list({ dbPath: DB_PATH });
  expect(list.length).toBe(2);
  expect(list[0].id).toBe(s2.id);
});

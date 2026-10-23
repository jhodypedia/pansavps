import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "./data/app.db";

function ensureDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

type GlobalDb = {
  sqlite?: Database.Database;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

const globalForDb = globalThis as unknown as GlobalDb;

function createConnection() {
  ensureDir(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  // Cache 64 MB dan mmap 256 MB cukup untuk dataset toko ini, tanpa
  // menghabiskan RAM VPS 4 GB.
  sqlite.pragma("cache_size = -64000");
  sqlite.pragma("temp_store = MEMORY");
  sqlite.pragma("mmap_size = 268435456");
  try {
    sqlite.exec(
      "CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at)",
    );
  } catch {
    // Tabel belum ada pada database baru; migrasi akan membuatnya.
  }
  return sqlite;
}

const sqlite = globalForDb.sqlite ?? createConnection();
if (process.env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = globalForDb.db ?? drizzle(sqlite, { schema });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export { sqlite };
export * from "./schema";

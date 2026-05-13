import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

let _client: Client | null = null;
let _migrated = false;

export async function db(): Promise<Client> {
  if (_client) return _client;

  const url = resolveUrl();
  const authToken = (process.env.DATABASE_AUTH_TOKEN ?? "").trim() || undefined;

  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && !filePath.startsWith(":memory:")) {
      mkdirSync(dirname(resolve(filePath)), { recursive: true });
    }
  }

  _client = createClient({ url, authToken });
  if (!_migrated) {
    await migrate(_client);
    _migrated = true;
  }
  return _client;
}

function resolveUrl(): string {
  const remote = (process.env.DATABASE_URL ?? "").trim();
  if (remote) return remote;
  return `file:${(process.env.DRIFT_DB_PATH ?? "./data/drift.db").trim()}`;
}

async function migrate(client: Client) {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'other',
        label TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(competitor_id, url),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_snapshots_source_time
        ON snapshots(source_id, fetched_at DESC)`,
      `CREATE TABLE IF NOT EXISTS digests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        urgency TEXT NOT NULL DEFAULT 'low',
        body_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_digests_competitor_time
        ON digests(competitor_id, created_at DESC)`,
      `CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'slack',
        label TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_delivered_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(competitor_id, url),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_webhooks_competitor
        ON webhooks(competitor_id)`,
      `CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT 'pro',
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_waitlist_created
        ON waitlist(created_at DESC)`,
    ],
    "write",
  );
}

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

/** Owner's workspace id. Always exists after migration. */
export const OWNER_WORKSPACE_ID = 1;

async function migrate(client: Client) {
  // ---- Phase 1: Create tables ----
  // CREATE TABLE IF NOT EXISTS is a no-op when the table already exists,
  // so the workspace_id column in new-style CREATEs is only honored for
  // brand-new databases. Existing tables get workspace_id via ALTER below.
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        owner_email TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT 'hosted',
        token_hash TEXT,
        stripe_customer_id TEXT,
        competitor_limit INTEGER NOT NULL DEFAULT 10,
        source_limit_per_competitor INTEGER NOT NULL DEFAULT 5,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS competitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL DEFAULT 1,
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
      `CREATE TABLE IF NOT EXISTS digests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL DEFAULT 1,
        competitor_id INTEGER NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        urgency TEXT NOT NULL DEFAULT 'low',
        body_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (competitor_id) REFERENCES competitors(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL DEFAULT 1,
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
      `CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT 'pro',
        message TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ],
    "write",
  );

  // ---- Phase 2: ALTER TABLE for already-deployed databases ----
  // Idempotent: swallows "duplicate column" errors.
  await tryAddColumn(client, "competitors", "workspace_id", "INTEGER NOT NULL DEFAULT 1");
  await tryAddColumn(client, "sources", "workspace_id", "INTEGER NOT NULL DEFAULT 1");
  await tryAddColumn(client, "digests", "workspace_id", "INTEGER NOT NULL DEFAULT 1");
  await tryAddColumn(client, "webhooks", "workspace_id", "INTEGER NOT NULL DEFAULT 1");

  // Pre-launch hardening: competitor verification (identity anchor) + workspace scheduling + Stripe subscription state
  await tryAddColumn(client, "competitors", "description", "TEXT NOT NULL DEFAULT ''");
  await tryAddColumn(client, "competitors", "verified_summary", "TEXT");
  await tryAddColumn(client, "competitors", "verified_at", "TEXT");
  await tryAddColumn(client, "workspaces", "digest_day_of_week", "INTEGER NOT NULL DEFAULT 1");
  await tryAddColumn(client, "workspaces", "subscription_active", "INTEGER NOT NULL DEFAULT 1");
  await tryAddColumn(client, "workspaces", "subscription_status", "TEXT NOT NULL DEFAULT 'active'");

  // ---- Phase 3: Indexes (now safe — columns exist) ----
  await client.batch(
    [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_token
        ON workspaces(token_hash)
        WHERE token_hash IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_competitors_workspace
        ON competitors(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sources_workspace
        ON sources(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_snapshots_source_time
        ON snapshots(source_id, fetched_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_digests_workspace_time
        ON digests(workspace_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_digests_competitor_time
        ON digests(competitor_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_webhooks_workspace
        ON webhooks(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_webhooks_competitor
        ON webhooks(competitor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_waitlist_created
        ON waitlist(created_at DESC)`,
    ],
    "write",
  );

  // ---- Phase 4: Seed the owner workspace (id=1) ----
  await client.execute({
    sql: `INSERT OR IGNORE INTO workspaces
            (id, slug, name, owner_email, plan, competitor_limit, source_limit_per_competitor)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      OWNER_WORKSPACE_ID,
      "owner",
      "Owner",
      "",
      "owner",
      999,
      999,
    ],
  });
}

async function tryAddColumn(
  client: Client,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (!/duplicate column/i.test(msg)) {
      throw e;
    }
  }
}

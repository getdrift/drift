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

  // Pre-multi-tenant competitors had UNIQUE(domain) — blocks two workspaces
  // from tracking the same company. Rebuild the table once to switch to
  // UNIQUE(workspace_id, domain). Detect by checking the CREATE statement.
  const schemaCheck = await client.execute({
    sql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='competitors'",
    args: [],
  });
  const schemaSql = String(
    (schemaCheck.rows[0] as unknown as { sql?: string } | undefined)?.sql ?? "",
  );
  // Old schema: "domain TEXT NOT NULL UNIQUE" inline.
  // New schema: "UNIQUE(workspace_id, domain)" as a table constraint.
  const hasNewUnique = /UNIQUE\s*\(\s*workspace_id\s*,\s*domain\s*\)/i.test(schemaSql);
  const hasLegacyInlineUnique =
    /domain\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(schemaSql);
  if (!hasNewUnique && hasLegacyInlineUnique) {
    await rebuildCompetitorsTable(client);
  }

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

/**
 * Rebuild competitors table to swap UNIQUE(domain) → UNIQUE(workspace_id, domain).
 * Idempotent caller — only runs when the legacy inline UNIQUE is detected.
 *
 * Disables foreign keys during the swap so the FK references in sources,
 * snapshots, digests, webhooks survive the DROP. All rows preserved with
 * original ids.
 */
async function rebuildCompetitorsTable(client: Client): Promise<void> {
  // libsql batch is transactional; run as one unit.
  await client.batch(
    [
      "PRAGMA foreign_keys = OFF",
      `CREATE TABLE competitors_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        verified_summary TEXT,
        verified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(workspace_id, domain)
      )`,
      `INSERT INTO competitors_new (id, workspace_id, name, domain, description, verified_summary, verified_at, created_at)
        SELECT id,
               COALESCE(workspace_id, 1),
               name,
               domain,
               COALESCE(description, ''),
               verified_summary,
               verified_at,
               created_at
        FROM competitors`,
      "DROP TABLE competitors",
      "ALTER TABLE competitors_new RENAME TO competitors",
      `CREATE INDEX IF NOT EXISTS idx_competitors_workspace ON competitors(workspace_id)`,
      "PRAGMA foreign_keys = ON",
    ],
    "write",
  );
}

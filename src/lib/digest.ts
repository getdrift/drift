import type { Row } from "@libsql/client";
import { db } from "./db";
import { scrape } from "./scraper";
import { synthesize, type SnapshotPair } from "./synthesizer";
import { deliver, type DeliveryResult } from "./notify";
import type {
  Competitor,
  Digest,
  DigestBody,
  Snapshot,
  Source,
  Webhook,
  WebhookKind,
} from "./types";

function rowToObj<T>(row: Row): T {
  return row as unknown as T;
}

// ---------- Competitors ----------

export async function listCompetitors(workspaceId: number): Promise<Competitor[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM competitors WHERE workspace_id = ? ORDER BY name",
    args: [workspaceId],
  });
  return r.rows.map(rowToObj<Competitor>);
}

export async function getCompetitor(
  workspaceId: number,
  idOrDomain: string | number,
): Promise<Competitor | undefined> {
  const client = await db();
  let r;
  if (typeof idOrDomain === "number") {
    r = await client.execute({
      sql: "SELECT * FROM competitors WHERE workspace_id = ? AND id = ?",
      args: [workspaceId, idOrDomain],
    });
  } else {
    r = await client.execute({
      sql: "SELECT * FROM competitors WHERE workspace_id = ? AND (domain = ? OR name = ?)",
      args: [workspaceId, idOrDomain, idOrDomain],
    });
  }
  return r.rows[0] ? rowToObj<Competitor>(r.rows[0]) : undefined;
}

export async function addCompetitor(
  workspaceId: number,
  name: string,
  domain: string,
  opts: {
    description?: string;
    verified_summary?: string;
  } = {},
): Promise<Competitor> {
  const client = await db();
  const now = opts.verified_summary ? new Date().toISOString() : null;
  const info = await client.execute({
    sql: `INSERT INTO competitors (workspace_id, name, domain, description, verified_summary, verified_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      workspaceId,
      name,
      domain,
      opts.description ?? "",
      opts.verified_summary ?? null,
      now,
    ],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM competitors WHERE id = ?",
    args: [id],
  });
  return rowToObj<Competitor>(r.rows[0]);
}

export async function countCompetitors(workspaceId: number): Promise<number> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM competitors WHERE workspace_id = ?",
    args: [workspaceId],
  });
  return Number((r.rows[0] as unknown as { c: number }).c);
}

export async function countSources(
  workspaceId: number,
  competitorId: number,
): Promise<number> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM sources WHERE workspace_id = ? AND competitor_id = ?",
    args: [workspaceId, competitorId],
  });
  return Number((r.rows[0] as unknown as { c: number }).c);
}

export async function removeCompetitor(workspaceId: number, id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM competitors WHERE workspace_id = ? AND id = ?",
    args: [workspaceId, id],
  });
}

// ---------- Sources ----------

export async function listSources(
  workspaceId: number,
  competitorId: number,
): Promise<Source[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM sources WHERE workspace_id = ? AND competitor_id = ? ORDER BY kind, label",
    args: [workspaceId, competitorId],
  });
  return r.rows.map(rowToObj<Source>);
}

export async function addSource(
  workspaceId: number,
  competitorId: number,
  url: string,
  kind: string,
  label: string,
): Promise<Source> {
  // Guard: competitor must belong to this workspace.
  const owner = await getCompetitor(workspaceId, competitorId);
  if (!owner) throw new Error(`Competitor ${competitorId} not in workspace`);
  const client = await db();
  const info = await client.execute({
    sql: "INSERT INTO sources (workspace_id, competitor_id, url, kind, label) VALUES (?, ?, ?, ?, ?)",
    args: [workspaceId, competitorId, url, kind, label],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM sources WHERE id = ?",
    args: [id],
  });
  return rowToObj<Source>(r.rows[0]);
}

export async function removeSource(workspaceId: number, id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM sources WHERE workspace_id = ? AND id = ?",
    args: [workspaceId, id],
  });
}

// ---------- Snapshots (workspace-scoped via source.workspace_id) ----------

export async function latestSnapshot(sourceId: number): Promise<Snapshot | undefined> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM snapshots WHERE source_id = ? ORDER BY fetched_at DESC LIMIT 1",
    args: [sourceId],
  });
  return r.rows[0] ? rowToObj<Snapshot>(r.rows[0]) : undefined;
}

export async function snapshotBefore(
  sourceId: number,
  isoTime: string,
): Promise<Snapshot | undefined> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM snapshots WHERE source_id = ? AND fetched_at < ? ORDER BY fetched_at DESC LIMIT 1",
    args: [sourceId, isoTime],
  });
  return r.rows[0] ? rowToObj<Snapshot>(r.rows[0]) : undefined;
}

// ---------- Webhooks ----------

export async function listWebhooks(
  workspaceId: number,
  competitorId: number,
): Promise<Webhook[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM webhooks WHERE workspace_id = ? AND competitor_id = ? ORDER BY id",
    args: [workspaceId, competitorId],
  });
  return r.rows.map(rowToObj<Webhook>);
}

export async function addWebhook(
  workspaceId: number,
  competitorId: number,
  url: string,
  kind: WebhookKind,
  label: string,
): Promise<Webhook> {
  const owner = await getCompetitor(workspaceId, competitorId);
  if (!owner) throw new Error(`Competitor ${competitorId} not in workspace`);
  const client = await db();
  const info = await client.execute({
    sql: "INSERT INTO webhooks (workspace_id, competitor_id, url, kind, label) VALUES (?, ?, ?, ?, ?)",
    args: [workspaceId, competitorId, url, kind, label],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM webhooks WHERE id = ?",
    args: [id],
  });
  return rowToObj<Webhook>(r.rows[0]);
}

export async function removeWebhook(workspaceId: number, id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM webhooks WHERE workspace_id = ? AND id = ?",
    args: [workspaceId, id],
  });
}

export async function setWebhookEnabled(
  workspaceId: number,
  id: number,
  enabled: boolean,
): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "UPDATE webhooks SET enabled = ? WHERE workspace_id = ? AND id = ?",
    args: [enabled ? 1 : 0, workspaceId, id],
  });
}

async function recordDelivery(result: DeliveryResult): Promise<void> {
  const client = await db();
  const now = new Date().toISOString();
  if (result.ok) {
    await client.execute({
      sql: "UPDATE webhooks SET last_delivered_at = ?, last_error = NULL WHERE id = ?",
      args: [now, result.webhook_id],
    });
  } else {
    await client.execute({
      sql: "UPDATE webhooks SET last_error = ? WHERE id = ?",
      args: [result.error ?? `HTTP ${result.status}`, result.webhook_id],
    });
  }
}

export async function deliverDigest(
  workspaceId: number,
  competitorId: number,
  digestId: number,
): Promise<DeliveryResult[]> {
  const competitor = await getCompetitor(workspaceId, competitorId);
  if (!competitor) return [];
  const digest = await readDigest(workspaceId, digestId);
  const webhooks = (await listWebhooks(workspaceId, competitorId)).filter((w) => w.enabled);
  const results: DeliveryResult[] = [];
  for (const w of webhooks) {
    const r = await deliver(w, competitor, digest);
    await recordDelivery(r);
    results.push(r);
  }
  return results;
}

// ---------- Fetch + digest ----------

export interface FetchResult {
  source: Source;
  ok: boolean;
  changed: boolean;
  status: number;
  error?: string;
}

export async function fetchAllForCompetitor(
  workspaceId: number,
  competitorId: number,
): Promise<FetchResult[]> {
  const sources = await listSources(workspaceId, competitorId);
  const results: FetchResult[] = [];
  for (const source of sources) {
    results.push(await fetchSource(source));
  }
  return results;
}

export async function fetchSource(source: Source): Promise<FetchResult> {
  const result = await scrape(source.url);
  if (!result.ok) {
    return {
      source,
      ok: false,
      changed: false,
      status: result.status,
      error: result.error,
    };
  }
  const prev = await latestSnapshot(source.id);
  const changed = !prev || prev.content_hash !== result.content_hash;
  if (changed) {
    const client = await db();
    await client.execute({
      sql: "INSERT INTO snapshots (source_id, content, content_hash) VALUES (?, ?, ?)",
      args: [source.id, result.content, result.content_hash],
    });
  }
  return { source, ok: true, changed, status: result.status };
}

export async function generateDigest(
  workspaceId: number,
  competitorId: number,
  periodStart: string,
  periodEnd: string,
): Promise<Digest> {
  const competitor = await getCompetitor(workspaceId, competitorId);
  if (!competitor) throw new Error(`Competitor ${competitorId} not in workspace`);

  const sources = await listSources(workspaceId, competitor.id);
  if (sources.length === 0) {
    throw new Error(`No sources configured for ${competitor.name}`);
  }

  const pairs: SnapshotPair[] = [];
  for (const source of sources) {
    const after = await latestSnapshot(source.id);
    if (!after) continue;
    const before = await snapshotBefore(source.id, periodStart);
    pairs.push({
      url: source.url,
      kind: source.kind as SnapshotPair["kind"],
      label: source.label,
      before: before?.content ?? null,
      after: after.content,
    });
  }

  if (pairs.length === 0) {
    throw new Error(
      `No snapshots available for ${competitor.name}. Run \`drift fetch\` first.`,
    );
  }

  const body = await synthesize(
    competitor.name,
    competitor.domain,
    periodStart,
    periodEnd,
    pairs,
    {
      identitySummary: competitor.verified_summary,
      customerDescription: competitor.description,
    },
  );

  const client = await db();
  const info = await client.execute({
    sql: `INSERT INTO digests (workspace_id, competitor_id, period_start, period_end, urgency, body_json)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      workspaceId,
      competitor.id,
      periodStart,
      periodEnd,
      body.urgency,
      JSON.stringify(body),
    ],
  });

  const digest = await readDigest(workspaceId, Number(info.lastInsertRowid));

  const webhooks = (await listWebhooks(workspaceId, competitor.id)).filter((w) => w.enabled);
  for (const w of webhooks) {
    const r = await deliver(w, competitor, digest);
    await recordDelivery(r);
  }

  return digest;
}

// ---------- Digests ----------

interface DigestRow {
  id: number;
  workspace_id: number;
  competitor_id: number;
  period_start: string;
  period_end: string;
  urgency: string;
  body_json: string;
  created_at: string;
}

export async function readDigest(workspaceId: number, id: number): Promise<Digest> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM digests WHERE workspace_id = ? AND id = ?",
    args: [workspaceId, id],
  });
  const row = r.rows[0];
  if (!row) throw new Error(`Digest ${id} not found`);
  return rowToDigest(rowToObj<DigestRow>(row));
}

export async function listDigests(
  workspaceId: number,
  competitorId?: number,
): Promise<Digest[]> {
  const client = await db();
  const r = competitorId
    ? await client.execute({
        sql: "SELECT * FROM digests WHERE workspace_id = ? AND competitor_id = ? ORDER BY created_at DESC",
        args: [workspaceId, competitorId],
      })
    : await client.execute({
        sql: "SELECT * FROM digests WHERE workspace_id = ? ORDER BY created_at DESC",
        args: [workspaceId],
      });
  return r.rows.map((row) => rowToDigest(rowToObj<DigestRow>(row)));
}

export async function removeDigest(workspaceId: number, id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM digests WHERE workspace_id = ? AND id = ?",
    args: [workspaceId, id],
  });
}

function rowToDigest(row: DigestRow): Digest {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    competitor_id: row.competitor_id,
    period_start: row.period_start,
    period_end: row.period_end,
    urgency: row.urgency as Digest["urgency"],
    body: JSON.parse(row.body_json) as DigestBody,
    created_at: row.created_at,
  };
}

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

export async function listCompetitors(): Promise<Competitor[]> {
  const client = await db();
  const r = await client.execute("SELECT * FROM competitors ORDER BY name");
  return r.rows.map(rowToObj<Competitor>);
}

export async function getCompetitor(
  idOrDomain: string | number,
): Promise<Competitor | undefined> {
  const client = await db();
  let r;
  if (typeof idOrDomain === "number") {
    r = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ?",
      args: [idOrDomain],
    });
  } else {
    r = await client.execute({
      sql: "SELECT * FROM competitors WHERE domain = ? OR name = ?",
      args: [idOrDomain, idOrDomain],
    });
  }
  return r.rows[0] ? rowToObj<Competitor>(r.rows[0]) : undefined;
}

export async function addCompetitor(name: string, domain: string): Promise<Competitor> {
  const client = await db();
  const info = await client.execute({
    sql: "INSERT INTO competitors (name, domain) VALUES (?, ?)",
    args: [name, domain],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM competitors WHERE id = ?",
    args: [id],
  });
  return rowToObj<Competitor>(r.rows[0]);
}

export async function removeCompetitor(id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM competitors WHERE id = ?",
    args: [id],
  });
}

export async function removeSource(id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM sources WHERE id = ?",
    args: [id],
  });
}

export async function removeDigest(id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM digests WHERE id = ?",
    args: [id],
  });
}

export async function listSources(competitorId: number): Promise<Source[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM sources WHERE competitor_id = ? ORDER BY kind, label",
    args: [competitorId],
  });
  return r.rows.map(rowToObj<Source>);
}

export async function addSource(
  competitorId: number,
  url: string,
  kind: string,
  label: string,
): Promise<Source> {
  const client = await db();
  const info = await client.execute({
    sql: "INSERT INTO sources (competitor_id, url, kind, label) VALUES (?, ?, ?, ?)",
    args: [competitorId, url, kind, label],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM sources WHERE id = ?",
    args: [id],
  });
  return rowToObj<Source>(r.rows[0]);
}

export async function latestSnapshot(
  sourceId: number,
): Promise<Snapshot | undefined> {
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

export async function listWebhooks(competitorId: number): Promise<Webhook[]> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM webhooks WHERE competitor_id = ? ORDER BY id",
    args: [competitorId],
  });
  return r.rows.map(rowToObj<Webhook>);
}

export async function addWebhook(
  competitorId: number,
  url: string,
  kind: WebhookKind,
  label: string,
): Promise<Webhook> {
  const client = await db();
  const info = await client.execute({
    sql: "INSERT INTO webhooks (competitor_id, url, kind, label) VALUES (?, ?, ?, ?)",
    args: [competitorId, url, kind, label],
  });
  const id = Number(info.lastInsertRowid);
  const r = await client.execute({
    sql: "SELECT * FROM webhooks WHERE id = ?",
    args: [id],
  });
  return rowToObj<Webhook>(r.rows[0]);
}

export async function removeWebhook(id: number): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "DELETE FROM webhooks WHERE id = ?",
    args: [id],
  });
}

export async function setWebhookEnabled(
  id: number,
  enabled: boolean,
): Promise<void> {
  const client = await db();
  await client.execute({
    sql: "UPDATE webhooks SET enabled = ? WHERE id = ?",
    args: [enabled ? 1 : 0, id],
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
  competitorId: number,
  digestId: number,
): Promise<DeliveryResult[]> {
  const competitor = await getCompetitor(competitorId);
  if (!competitor) return [];
  const digest = await readDigest(digestId);
  const webhooks = (await listWebhooks(competitorId)).filter((w) => w.enabled);
  const results: DeliveryResult[] = [];
  for (const w of webhooks) {
    const r = await deliver(w, competitor, digest);
    await recordDelivery(r);
    results.push(r);
  }
  return results;
}

export interface FetchResult {
  source: Source;
  ok: boolean;
  changed: boolean;
  status: number;
  error?: string;
}

export async function fetchAllForCompetitor(
  competitorId: number,
): Promise<FetchResult[]> {
  const sources = await listSources(competitorId);
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
  competitorId: number,
  periodStart: string,
  periodEnd: string,
): Promise<Digest> {
  const competitor = await getCompetitor(competitorId);
  if (!competitor) throw new Error(`Competitor ${competitorId} not found`);

  const sources = await listSources(competitor.id);
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
  );

  const client = await db();
  const info = await client.execute({
    sql: `INSERT INTO digests (competitor_id, period_start, period_end, urgency, body_json)
          VALUES (?, ?, ?, ?, ?)`,
    args: [competitor.id, periodStart, periodEnd, body.urgency, JSON.stringify(body)],
  });

  const digest = await readDigest(Number(info.lastInsertRowid));

  const webhooks = (await listWebhooks(competitor.id)).filter((w) => w.enabled);
  for (const w of webhooks) {
    const r = await deliver(w, competitor, digest);
    await recordDelivery(r);
  }

  return digest;
}

interface DigestRow {
  id: number;
  competitor_id: number;
  period_start: string;
  period_end: string;
  urgency: string;
  body_json: string;
  created_at: string;
}

export async function readDigest(id: number): Promise<Digest> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM digests WHERE id = ?",
    args: [id],
  });
  const row = r.rows[0];
  if (!row) throw new Error(`Digest ${id} not found`);
  return rowToDigest(rowToObj<DigestRow>(row));
}

export async function listDigests(competitorId?: number): Promise<Digest[]> {
  const client = await db();
  const r = competitorId
    ? await client.execute({
        sql: "SELECT * FROM digests WHERE competitor_id = ? ORDER BY created_at DESC",
        args: [competitorId],
      })
    : await client.execute("SELECT * FROM digests ORDER BY created_at DESC");
  return r.rows.map((row) => rowToDigest(rowToObj<DigestRow>(row)));
}

function rowToDigest(row: DigestRow): Digest {
  return {
    id: row.id,
    competitor_id: row.competitor_id,
    period_start: row.period_start,
    period_end: row.period_end,
    urgency: row.urgency as Digest["urgency"],
    body: JSON.parse(row.body_json) as DigestBody,
    created_at: row.created_at,
  };
}

import "dotenv/config";
import { db } from "../lib/db";

const client = await db();
const r = await client.execute(`
  SELECT s.url, s.kind, length(sn.content) AS len
  FROM sources s
  LEFT JOIN snapshots sn ON sn.id = (
    SELECT id FROM snapshots WHERE source_id = s.id ORDER BY fetched_at DESC LIMIT 1
  )
  ORDER BY s.competitor_id, s.kind
`);

for (const row of r.rows) {
  const r2 = row as unknown as { url: string; kind: string; len: number | null };
  const len = String(r2.len ?? 0).padStart(7);
  console.log(`  [${r2.kind.padEnd(10)}] len=${len}  ${r2.url}`);
}

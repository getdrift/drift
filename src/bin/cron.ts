#!/usr/bin/env node
import "dotenv/config";
import {
  fetchAllForCompetitor,
  generateDigest,
  listCompetitors,
} from "../lib/digest";

async function main() {
  const competitors = await listCompetitors();
  if (competitors.length === 0) {
    console.log("no competitors configured — nothing to do");
    return;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  let ok = 0;
  let fail = 0;

  for (const c of competitors) {
    console.log(`\n▸ ${c.name}`);
    try {
      const fetches = await fetchAllForCompetitor(c.id);
      const changed = fetches.filter((f) => f.changed).length;
      const errored = fetches.filter((f) => !f.ok).length;
      console.log(`  fetched: ${fetches.length}, changed: ${changed}, errors: ${errored}`);

      const digest = await generateDigest(c.id, startIso, endIso);
      console.log(`  digest #${digest.id} [${digest.urgency}]: ${digest.body.summary}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${e instanceof Error ? e.message : e}`);
      fail++;
    }
  }

  console.log(`\ndone — ${ok} ok, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

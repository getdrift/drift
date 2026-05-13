#!/usr/bin/env node
import "dotenv/config";
import {
  fetchAllForCompetitor,
  generateDigest,
  listCompetitors,
} from "../lib/digest";
import { listWorkspaces } from "../lib/workspace";

async function main() {
  const workspaces = await listWorkspaces();
  if (workspaces.length === 0) {
    console.log("no workspaces — bootstrap should have created the owner workspace, run init-db");
    return;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  let ok = 0;
  let fail = 0;

  for (const ws of workspaces) {
    const competitors = await listCompetitors(ws.id);
    if (competitors.length === 0) continue;
    console.log(`\n=== workspace: ${ws.slug} (${ws.plan}) — ${competitors.length} competitors ===`);

    for (const c of competitors) {
      console.log(`\n▸ ${c.name}`);
      try {
        const fetches = await fetchAllForCompetitor(ws.id, c.id);
        const changed = fetches.filter((f) => f.changed).length;
        const errored = fetches.filter((f) => !f.ok).length;
        console.log(`  fetched: ${fetches.length}, changed: ${changed}, errors: ${errored}`);

        const digest = await generateDigest(ws.id, c.id, startIso, endIso);
        console.log(`  digest #${digest.id} [${digest.urgency}]: ${digest.body.summary}`);
        ok++;
      } catch (e) {
        console.error(`  ✗ ${e instanceof Error ? e.message : e}`);
        fail++;
      }
    }
  }

  console.log(`\ndone — ${ok} ok, ${fail} failed across ${workspaces.length} workspaces`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

#!/usr/bin/env node
import "dotenv/config";
import {
  addCompetitor,
  addSource,
  addWebhook,
  deliverDigest,
  fetchAllForCompetitor,
  generateDigest,
  getCompetitor,
  listCompetitors,
  listDigests,
  listSources,
  listWebhooks,
  readDigest,
  removeCompetitor,
  removeDigest,
  removeSource,
  removeWebhook,
} from "../lib/digest";
import { db } from "../lib/db";
import type { Competitor, WebhookKind } from "../lib/types";

const HELP = `drift — competitive intel CLI

Usage:
  drift init-db
  drift add <name> <domain>
  drift source <competitor> <url> [--kind=KIND] [--label=LABEL]
  drift list
  drift fetch [competitor]
  drift digest <competitor> [--days=7]
  drift digests [competitor]
  drift show <digest-id>
  drift seed

  drift webhook add <competitor> <url> [--kind=slack|discord|generic|email] [--label=LABEL]
  drift webhook list [competitor]
  drift webhook remove <id>
  drift webhook test <competitor>   redelivers latest digest

  drift remove competitor <selector>
  drift remove source <id>
  drift remove digest <id>

Source kinds: homepage, pricing, changelog, blog, docs, jobs, about, other
Competitor selectors accept domain, name, or numeric id.
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      return;
    case "init-db":
      await db();
      console.log(
        "✓ database initialized at",
        process.env.DATABASE_URL ?? `file:${process.env.DRIFT_DB_PATH ?? "./data/drift.db"}`,
      );
      return;
    case "add":
      return cmdAdd(rest);
    case "source":
      return cmdSource(rest);
    case "list":
      return cmdList();
    case "fetch":
      return cmdFetch(rest);
    case "digest":
      return cmdDigest(rest);
    case "digests":
      return cmdDigests(rest);
    case "show":
      return cmdShow(rest);
    case "seed":
      return cmdSeed();
    case "webhook":
      return cmdWebhook(rest);
    case "remove":
      return cmdRemove(rest);
    default:
      console.error(`unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

async function cmdAdd(args: string[]) {
  const [name, domain] = args;
  if (!name || !domain) die("usage: drift add <name> <domain>");
  const c = await addCompetitor(name, domain);
  console.log(`✓ added competitor #${c.id}: ${c.name} (${c.domain})`);
}

async function cmdSource(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [selector, url] = positional;
  if (!selector || !url) die("usage: drift source <competitor> <url> [--kind=KIND] [--label=LABEL]");
  const c = await resolveCompetitor(selector);
  const kind = flags.kind ?? guessKind(url);
  const label = flags.label ?? defaultLabel(kind);
  const s = await addSource(c.id, url, kind, label);
  console.log(`✓ added source #${s.id}: [${s.kind}] ${s.label} → ${s.url}`);
}

async function cmdList() {
  const competitors = await listCompetitors();
  if (competitors.length === 0) {
    console.log("(no competitors yet — `drift add <name> <domain>`)");
    return;
  }
  for (const c of competitors) {
    console.log(`\n#${c.id}  ${c.name}  (${c.domain})`);
    const sources = await listSources(c.id);
    if (sources.length === 0) {
      console.log("  (no sources)");
      continue;
    }
    for (const s of sources) {
      console.log(`  [${s.kind.padEnd(10)}] ${s.label.padEnd(20)} ${s.url}`);
    }
  }
}

async function cmdFetch(args: string[]) {
  const targets: Competitor[] = args.length > 0
    ? [await resolveCompetitor(args[0])]
    : await listCompetitors();
  if (targets.length === 0) die("no competitors to fetch");
  for (const c of targets) {
    console.log(`\n▸ ${c.name}`);
    const results = await fetchAllForCompetitor(c.id);
    if (results.length === 0) {
      console.log("  (no sources configured)");
      continue;
    }
    for (const r of results) {
      const mark = !r.ok ? "✗" : r.changed ? "●" : "·";
      const status = r.ok
        ? r.changed ? "changed" : "unchanged"
        : `error ${r.status} ${r.error ?? ""}`;
      console.log(`  ${mark} [${r.source.kind}] ${r.source.url} — ${status}`);
    }
  }
}

async function cmdDigest(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [selector] = positional;
  if (!selector) die("usage: drift digest <competitor> [--days=7]");
  const c = await resolveCompetitor(selector);
  const days = Number(flags.days ?? 7);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  console.log(`▸ generating digest for ${c.name} (${days}d)…`);
  const d = await generateDigest(c.id, start.toISOString(), end.toISOString());
  printDigest(d, c.name);
}

async function cmdDigests(args: string[]) {
  const selector = args[0];
  const competitorId = selector ? (await resolveCompetitor(selector)).id : undefined;
  const digests = await listDigests(competitorId);
  if (digests.length === 0) {
    console.log("(no digests yet — `drift digest <competitor>`)");
    return;
  }
  for (const d of digests) {
    const c = await getCompetitor(d.competitor_id);
    console.log(
      `#${d.id}  [${d.urgency.padEnd(6)}]  ${c?.name ?? "?"}  ${d.created_at}`,
    );
    console.log(`     ${d.body.summary}`);
  }
}

async function cmdShow(args: string[]) {
  const [idStr] = args;
  if (!idStr) die("usage: drift show <digest-id>");
  const d = await readDigest(Number(idStr));
  const c = await getCompetitor(d.competitor_id);
  printDigest(d, c?.name ?? "?");
}

async function cmdWebhook(args: string[]) {
  const [sub, ...rest] = args;
  switch (sub) {
    case "add": {
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const [selector, url] = positional;
      if (!selector || !url) die("usage: drift webhook add <competitor> <url> [--kind=slack|discord|generic|email]");
      const c = await resolveCompetitor(selector);
      const kind = (flags.kind ?? guessWebhookKind(url)) as WebhookKind;
      const label = flags.label ?? defaultLabel(kind);
      const w = await addWebhook(c.id, url, kind, label);
      console.log(`✓ added webhook #${w.id}: [${w.kind}] ${w.label} for ${c.name}`);
      return;
    }
    case "list": {
      const selector = rest[0];
      const competitors = selector ? [await resolveCompetitor(selector)] : await listCompetitors();
      for (const c of competitors) {
        const webhooks = await listWebhooks(c.id);
        if (webhooks.length === 0) continue;
        console.log(`\n${c.name} (${c.domain})`);
        for (const w of webhooks) {
          const status = w.enabled ? "on " : "off";
          const last = w.last_delivered_at ? `last: ${w.last_delivered_at.slice(0, 16)}` : "never delivered";
          const err = w.last_error ? `  ✗ ${w.last_error}` : "";
          console.log(`  #${w.id} [${status}] [${w.kind.padEnd(7)}] ${w.label}  ${last}${err}`);
          console.log(`        ${maskUrl(w.url)}`);
        }
      }
      return;
    }
    case "remove": {
      const [idStr] = rest;
      if (!idStr) die("usage: drift webhook remove <id>");
      await removeWebhook(Number(idStr));
      console.log(`✓ removed webhook #${idStr}`);
      return;
    }
    case "test": {
      const [selector] = rest;
      if (!selector) die("usage: drift webhook test <competitor>");
      const c = await resolveCompetitor(selector);
      const latest = (await listDigests(c.id))[0];
      if (!latest) die(`no digest yet for ${c.name} — run \`drift digest ${c.domain}\` first`);
      const results = await deliverDigest(c.id, latest.id);
      if (results.length === 0) {
        console.log(`(no enabled webhooks for ${c.name})`);
        return;
      }
      for (const r of results) {
        const mark = r.ok ? "✓" : "✗";
        console.log(`  ${mark} webhook #${r.webhook_id}: HTTP ${r.status} ${r.error ?? ""}`);
      }
      return;
    }
    default:
      die("usage: drift webhook <add|list|remove|test> …");
  }
}

async function cmdRemove(args: string[]) {
  const [target, value] = args;
  if (!target || !value) die("usage: drift remove <competitor|source|digest> <id-or-selector>");
  switch (target) {
    case "competitor": {
      const c = await resolveCompetitor(value);
      await removeCompetitor(c.id);
      console.log(`✓ removed competitor #${c.id} ${c.name} and all its sources, webhooks, digests`);
      return;
    }
    case "source": {
      await removeSource(Number(value));
      console.log(`✓ removed source #${value}`);
      return;
    }
    case "digest": {
      await removeDigest(Number(value));
      console.log(`✓ removed digest #${value}`);
      return;
    }
    default:
      die("usage: drift remove <competitor|source|digest> <id-or-selector>");
  }
}

function guessWebhookKind(url: string): WebhookKind {
  const u = url.toLowerCase();
  if (u.startsWith("mailto:") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "email";
  if (u.includes("hooks.slack.com")) return "slack";
  if (u.includes("discord.com/api/webhooks") || u.includes("discordapp.com/api/webhooks")) return "discord";
  return "generic";
}

function maskUrl(url: string): string {
  if (url.length <= 60) return url;
  return url.slice(0, 40) + "…" + url.slice(-12);
}

async function cmdSeed() {
  const seeds: Array<[string, string, Array<[string, string, string]>]> = [
    [
      "Linear",
      "linear.app",
      [
        ["https://linear.app", "homepage", "Homepage"],
        ["https://linear.app/pricing", "pricing", "Pricing"],
        ["https://linear.app/changelog", "changelog", "Changelog"],
      ],
    ],
    [
      "Vercel",
      "vercel.com",
      [
        ["https://vercel.com", "homepage", "Homepage"],
        ["https://vercel.com/pricing", "pricing", "Pricing"],
        ["https://vercel.com/changelog", "changelog", "Changelog"],
      ],
    ],
  ];
  for (const [name, domain, sources] of seeds) {
    let c = await getCompetitor(domain);
    if (!c) {
      c = await addCompetitor(name, domain);
      console.log(`✓ seeded ${name}`);
    } else {
      console.log(`· ${name} already exists`);
    }
    for (const [url, kind, label] of sources) {
      try {
        await addSource(c.id, url, kind, label);
      } catch {
        // unique constraint — already added
      }
    }
  }
}

function printDigest(d: { id: number; urgency: string; body: { summary: string; key_changes: string[]; strategic_signals: string[]; recommended_actions: string[] }; period_start: string; period_end: string }, name: string) {
  const bar = "─".repeat(60);
  console.log(`\n${bar}`);
  console.log(` DIGEST #${d.id}  ${name}  [${d.urgency.toUpperCase()}]`);
  console.log(` ${d.period_start.slice(0, 10)} → ${d.period_end.slice(0, 10)}`);
  console.log(bar);
  console.log(`\n${d.body.summary}\n`);
  section("KEY CHANGES", d.body.key_changes);
  section("STRATEGIC SIGNALS", d.body.strategic_signals);
  section("RECOMMENDED ACTIONS", d.body.recommended_actions);
}

function section(title: string, items: string[]) {
  if (items.length === 0) return;
  console.log(title);
  for (const item of items) console.log(`  • ${item}`);
  console.log();
}

function parseFlags(args: string[], positional: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const a of args) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      flags[k] = v ?? "true";
    } else {
      positional.push(a);
    }
  }
  return flags;
}

async function resolveCompetitor(selector: string): Promise<Competitor> {
  const asNum = Number(selector);
  const c = Number.isFinite(asNum) && !selector.includes(".")
    ? await getCompetitor(asNum)
    : await getCompetitor(selector);
  if (!c) die(`competitor not found: ${selector}`);
  return c;
}

function guessKind(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("pricing")) return "pricing";
  if (u.includes("changelog") || u.includes("release")) return "changelog";
  if (u.includes("blog") || u.includes("news")) return "blog";
  if (u.includes("docs")) return "docs";
  if (u.includes("careers") || u.includes("jobs")) return "jobs";
  if (u.includes("about")) return "about";
  try {
    const p = new URL(url).pathname;
    if (p === "/" || p === "") return "homepage";
  } catch {}
  return "other";
}

function defaultLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

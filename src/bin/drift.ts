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
import { db, OWNER_WORKSPACE_ID } from "../lib/db";
import {
  createWorkspace,
  findWorkspaceBySlug,
  listWorkspaces,
  regenerateToken,
  sendWorkspaceWelcomeEmail,
  setStripeCustomerId,
  softDeleteWorkspace,
} from "../lib/workspace";
import type { Competitor, WebhookKind, Workspace } from "../lib/types";

const HELP = `drift — competitive intel CLI

Usage:
  drift init-db
  drift add <name> <domain> [--workspace=SLUG]
  drift source <competitor> <url> [--kind=KIND] [--label=LABEL] [--workspace=SLUG]
  drift list [--workspace=SLUG]
  drift fetch [competitor] [--workspace=SLUG]
  drift digest <competitor> [--days=7] [--workspace=SLUG]
  drift digests [competitor] [--workspace=SLUG]
  drift show <digest-id> [--workspace=SLUG]
  drift seed [--workspace=SLUG]

  drift webhook add <competitor> <url> [--kind=slack|discord|generic|email] [--label=LABEL] [--workspace=SLUG]
  drift webhook list [competitor] [--workspace=SLUG]
  drift webhook remove <id> [--workspace=SLUG]
  drift webhook test <competitor> [--workspace=SLUG]   redelivers latest digest

  drift remove competitor <selector> [--workspace=SLUG]
  drift remove source <id> [--workspace=SLUG]
  drift remove digest <id> [--workspace=SLUG]

  drift workspace add <email> [--name=NAME] [--plan=hosted|agency] [--stripe-customer=cus_XXX] [--no-email]
  drift workspace list
  drift workspace token <slug>           regenerate access token, prints + emails new one
  drift workspace stripe-link <slug> <cus_XXX>   link Stripe customer ID for webhook-driven state
  drift workspace remove <slug>

Source kinds: homepage, pricing, changelog, blog, docs, jobs, about, other
Competitor selectors accept domain, name, or numeric id.
Default workspace is "owner" (your admin workspace). Use --workspace=SLUG to
operate on a customer's workspace from the CLI.
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
      return cmdList(rest);
    case "fetch":
      return cmdFetch(rest);
    case "digest":
      return cmdDigest(rest);
    case "digests":
      return cmdDigests(rest);
    case "show":
      return cmdShow(rest);
    case "seed":
      return cmdSeed(rest);
    case "webhook":
      return cmdWebhook(rest);
    case "remove":
      return cmdRemove(rest);
    case "workspace":
      return cmdWorkspace(rest);
    default:
      console.error(`unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

// ---------- Workspace helpers ----------

async function resolveWorkspaceId(flags: Record<string, string>): Promise<number> {
  const slug = flags.workspace;
  if (!slug || slug === "owner") return OWNER_WORKSPACE_ID;
  const ws = await findWorkspaceBySlug(slug);
  if (!ws) die(`workspace not found: ${slug}`);
  return ws.id;
}

// ---------- Commands ----------

async function cmdAdd(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [name, domain] = positional;
  if (!name || !domain) die("usage: drift add <name> <domain> [--workspace=SLUG]");
  const workspaceId = await resolveWorkspaceId(flags);
  const c = await addCompetitor(workspaceId, name, domain);
  console.log(`✓ added competitor #${c.id}: ${c.name} (${c.domain})`);
}

async function cmdSource(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [selector, url] = positional;
  if (!selector || !url) {
    die("usage: drift source <competitor> <url> [--kind=KIND] [--label=LABEL] [--workspace=SLUG]");
  }
  const workspaceId = await resolveWorkspaceId(flags);
  const c = await resolveCompetitor(workspaceId, selector);
  const kind = flags.kind ?? guessKind(url);
  const label = flags.label ?? defaultLabel(kind);
  const s = await addSource(workspaceId, c.id, url, kind, label);
  console.log(`✓ added source #${s.id}: [${s.kind}] ${s.label} → ${s.url}`);
}

async function cmdList(args: string[]) {
  const flags = parseFlags(args, []);
  const workspaceId = await resolveWorkspaceId(flags);
  const competitors = await listCompetitors(workspaceId);
  if (competitors.length === 0) {
    console.log("(no competitors yet — `drift add <name> <domain>`)");
    return;
  }
  for (const c of competitors) {
    console.log(`\n#${c.id}  ${c.name}  (${c.domain})`);
    const sources = await listSources(workspaceId, c.id);
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
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const workspaceId = await resolveWorkspaceId(flags);
  const targets: Competitor[] =
    positional.length > 0
      ? [await resolveCompetitor(workspaceId, positional[0])]
      : await listCompetitors(workspaceId);
  if (targets.length === 0) die("no competitors to fetch");
  for (const c of targets) {
    console.log(`\n▸ ${c.name}`);
    const results = await fetchAllForCompetitor(workspaceId, c.id);
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
  if (!selector) die("usage: drift digest <competitor> [--days=7] [--workspace=SLUG]");
  const workspaceId = await resolveWorkspaceId(flags);
  const c = await resolveCompetitor(workspaceId, selector);
  const days = Number(flags.days ?? 7);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  console.log(`▸ generating digest for ${c.name} (${days}d)…`);
  const d = await generateDigest(workspaceId, c.id, start.toISOString(), end.toISOString());
  printDigest(d, c.name);
}

async function cmdDigests(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const workspaceId = await resolveWorkspaceId(flags);
  const competitorId = positional[0]
    ? (await resolveCompetitor(workspaceId, positional[0])).id
    : undefined;
  const digests = await listDigests(workspaceId, competitorId);
  if (digests.length === 0) {
    console.log("(no digests yet — `drift digest <competitor>`)");
    return;
  }
  for (const d of digests) {
    const c = await getCompetitor(workspaceId, d.competitor_id);
    console.log(
      `#${d.id}  [${d.urgency.padEnd(6)}]  ${c?.name ?? "?"}  ${d.created_at}`,
    );
    console.log(`     ${d.body.summary}`);
  }
}

async function cmdShow(args: string[]) {
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [idStr] = positional;
  if (!idStr) die("usage: drift show <digest-id> [--workspace=SLUG]");
  const workspaceId = await resolveWorkspaceId(flags);
  const d = await readDigest(workspaceId, Number(idStr));
  const c = await getCompetitor(workspaceId, d.competitor_id);
  printDigest(d, c?.name ?? "?");
}

async function cmdWebhook(args: string[]) {
  const [sub, ...rest] = args;
  switch (sub) {
    case "add": {
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const [selector, url] = positional;
      if (!selector || !url) {
        die("usage: drift webhook add <competitor> <url> [--kind=slack|discord|generic|email] [--workspace=SLUG]");
      }
      const workspaceId = await resolveWorkspaceId(flags);
      const c = await resolveCompetitor(workspaceId, selector);
      const kind = (flags.kind ?? guessWebhookKind(url)) as WebhookKind;
      const label = flags.label ?? defaultLabel(kind);
      const w = await addWebhook(workspaceId, c.id, url, kind, label);
      console.log(`✓ added webhook #${w.id}: [${w.kind}] ${w.label} for ${c.name}`);
      return;
    }
    case "list": {
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const workspaceId = await resolveWorkspaceId(flags);
      const competitors = positional[0]
        ? [await resolveCompetitor(workspaceId, positional[0])]
        : await listCompetitors(workspaceId);
      for (const c of competitors) {
        const webhooks = await listWebhooks(workspaceId, c.id);
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
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const [idStr] = positional;
      if (!idStr) die("usage: drift webhook remove <id> [--workspace=SLUG]");
      const workspaceId = await resolveWorkspaceId(flags);
      await removeWebhook(workspaceId, Number(idStr));
      console.log(`✓ removed webhook #${idStr}`);
      return;
    }
    case "test": {
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const [selector] = positional;
      if (!selector) die("usage: drift webhook test <competitor> [--workspace=SLUG]");
      const workspaceId = await resolveWorkspaceId(flags);
      const c = await resolveCompetitor(workspaceId, selector);
      const latest = (await listDigests(workspaceId, c.id))[0];
      if (!latest) die(`no digest yet for ${c.name} — run \`drift digest ${c.domain}\` first`);
      const results = await deliverDigest(workspaceId, c.id, latest.id);
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
  const positional: string[] = [];
  const flags = parseFlags(args, positional);
  const [target, value] = positional;
  if (!target || !value) die("usage: drift remove <competitor|source|digest> <id-or-selector>");
  const workspaceId = await resolveWorkspaceId(flags);
  switch (target) {
    case "competitor": {
      const c = await resolveCompetitor(workspaceId, value);
      await removeCompetitor(workspaceId, c.id);
      console.log(`✓ removed competitor #${c.id} ${c.name} and all its sources, webhooks, digests`);
      return;
    }
    case "source": {
      await removeSource(workspaceId, Number(value));
      console.log(`✓ removed source #${value}`);
      return;
    }
    case "digest": {
      await removeDigest(workspaceId, Number(value));
      console.log(`✓ removed digest #${value}`);
      return;
    }
    default:
      die("usage: drift remove <competitor|source|digest> <id-or-selector>");
  }
}

async function cmdWorkspace(args: string[]) {
  const [sub, ...rest] = args;
  switch (sub) {
    case "add": {
      const positional: string[] = [];
      const flags = parseFlags(rest, positional);
      const [email] = positional;
      if (!email) die("usage: drift workspace add <email> [--name=NAME] [--plan=hosted|agency] [--stripe-customer=cus_XXX] [--no-email]");
      const plan = (flags.plan ?? "hosted") as "hosted" | "agency";
      const { workspace, plainToken } = await createWorkspace({
        email,
        name: flags.name,
        plan,
        stripeCustomerId: flags["stripe-customer"] ?? null,
      });
      printWorkspaceCreated(workspace, plainToken);

      if (flags["no-email"] === "true") {
        console.log("\n(skipped welcome email — pass without --no-email to send)");
      } else {
        const result = await sendWorkspaceWelcomeEmail(workspace, plainToken);
        if (result.skipped) {
          console.log("\n⚠ welcome email NOT sent: RESEND_API_KEY not set");
          console.log("  → set it in .env, then resend with: drift workspace token", workspace.slug);
        } else if (!result.ok) {
          console.log(`\n⚠ welcome email failed: ${result.error}`);
        } else {
          console.log(`\n✓ welcome email sent to ${workspace.owner_email}`);
        }
      }
      return;
    }
    case "list": {
      const workspaces = await listWorkspaces();
      console.log(`\n${workspaces.length} workspace(s):\n`);
      for (const ws of workspaces) {
        console.log(
          `  #${ws.id} ${ws.slug.padEnd(20)} ${ws.plan.padEnd(8)} ${ws.owner_email.padEnd(35)} ${ws.competitor_limit} comp / ${ws.source_limit_per_competitor} src`,
        );
      }
      return;
    }
    case "token": {
      const [slug] = rest;
      if (!slug) die("usage: drift workspace token <slug>");
      const ws = await findWorkspaceBySlug(slug);
      if (!ws) die(`workspace not found: ${slug}`);
      const plain = await regenerateToken(ws.id);
      printWorkspaceCreated(ws, plain);
      const result = await sendWorkspaceWelcomeEmail(ws, plain);
      if (result.ok) console.log(`\n✓ email re-sent to ${ws.owner_email}`);
      else console.log(`\n⚠ email not sent: ${result.error ?? "skipped"}`);
      return;
    }
    case "stripe-link": {
      const [slug, customerId] = rest;
      if (!slug || !customerId) die("usage: drift workspace stripe-link <slug> <cus_XXX>");
      const ws = await findWorkspaceBySlug(slug);
      if (!ws) die(`workspace not found: ${slug}`);
      if (!customerId.startsWith("cus_")) {
        die(`Stripe customer IDs start with "cus_" — got: ${customerId}`);
      }
      await setStripeCustomerId(ws.id, customerId);
      console.log(`✓ linked ${ws.slug} → Stripe customer ${customerId}`);
      console.log(`  Cancel/payment-failure events on this customer will now`);
      console.log(`  flip ${ws.slug}'s subscription_active automatically.`);
      return;
    }
    case "remove": {
      const [slug] = rest;
      if (!slug) die("usage: drift workspace remove <slug>");
      const ws = await findWorkspaceBySlug(slug);
      if (!ws) die(`workspace not found: ${slug}`);
      await softDeleteWorkspace(ws.id);
      console.log(`✓ soft-deleted workspace ${ws.slug} (data kept 30 days then purged)`);
      return;
    }
    default:
      die("usage: drift workspace <add|list|token|stripe-link|remove> …");
  }
}

function printWorkspaceCreated(ws: Workspace, plainToken: string) {
  const siteUrl = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
  const loginUrl = `${siteUrl}/api/login?token=${plainToken}`;
  const bar = "─".repeat(72);
  console.log(`\n${bar}`);
  console.log(` WORKSPACE PROVISIONED  #${ws.id}  ${ws.slug}  [${ws.plan}]`);
  console.log(bar);
  console.log(`  Email:        ${ws.owner_email}`);
  console.log(`  Name:         ${ws.name}`);
  console.log(`  Competitors:  ${ws.competitor_limit} max`);
  console.log(`  Sources/comp: ${ws.source_limit_per_competitor} max`);
  console.log("");
  console.log("  Login URL (share this with the customer):");
  console.log(`  ${loginUrl}`);
  console.log("");
  console.log("  Raw token (standalone, for support):");
  console.log(`  ${plainToken}`);
  console.log(bar);
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

async function cmdSeed(args: string[]) {
  const flags = parseFlags(args, []);
  const workspaceId = await resolveWorkspaceId(flags);
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
    let c = await getCompetitor(workspaceId, domain);
    if (!c) {
      c = await addCompetitor(workspaceId, name, domain);
      console.log(`✓ seeded ${name}`);
    } else {
      console.log(`· ${name} already exists`);
    }
    for (const [url, kind, label] of sources) {
      try {
        await addSource(workspaceId, c.id, url, kind, label);
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

async function resolveCompetitor(
  workspaceId: number,
  selector: string,
): Promise<Competitor> {
  const asNum = Number(selector);
  const c = Number.isFinite(asNum) && !selector.includes(".")
    ? await getCompetitor(workspaceId, asNum)
    : await getCompetitor(workspaceId, selector);
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

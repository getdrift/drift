# drift

Weekly competitive intel for B2B SaaS founders. You give it 3–15 competitors and the URLs you'd otherwise check yourself (pricing, changelog, jobs, blog). It scrapes them, diffs the snapshots against last week, and uses an advanced AI model to write a brief that tells you what actually moved — and what you should consider doing about it.

**Zero-cost stack.** Free AI inference (Gemini 2.5 Flash's 1,500 req/day tier, no card) + self-host on any machine you already own — Raspberry Pi, mini PC, VPS free tier, Vercel free tier, whatever. Storage is a single SQLite file. You can run the entire thing without paying anyone. Swap the model provider via a single env var.

## What it does

- **Scrapes** pricing, changelog, blog, jobs, docs, homepage pages. Handles JS-rendered sites (Next.js, Remix, Apollo, TanStack) by extracting content from hydration JSON islands, not just visible DOM.
- **Snapshots** each fetch in SQLite with a content hash — only stores actual diffs as history compounds.
- **Synthesizes** with an advanced AI model (Gemini 2.5 Flash by default) — filters out noise (rotating testimonials, footer dates), surfaces signal (price changes, new tiers, hiring patterns, deprecations, repositioning), and connects dots across sources.
- **Delivers** to email (Resend), Slack, Discord, or any generic webhook. Each digest has `summary`, `key_changes`, `strategic_signals`, `recommended_actions`, and an `urgency` rating.
- **Schedules** itself via Vercel Cron or any cron runner — weekly auto-fetch + auto-digest + auto-deliver.

Use the CLI for one-offs, the dashboard for browsing, the cron for hands-off weekly runs.

## Quickstart

```bash
npm install
cp .env.example .env       # paste your GEMINI_API_KEY
npm run init-db
npm run seed               # adds Linear and Vercel as samples
npm run dev                # then http://localhost:3000
```

**For local dev**, leave `DRIFT_PASSWORD` empty in `.env` — auth is disabled and `/app` is open. **Before deploying publicly**, set both:

```
DRIFT_PASSWORD=your-strong-password
DRIFT_AUTH_SECRET=run `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`
```

Routes:
- **`/`** — landing page (marketing pitch + real digest preview)
- **`/demo`** — public demo showing real synthesized digests
- **`/app`** — dashboard (add competitors, sources, webhooks)
- **`/app/digests`** — global digest index with urgency filter
- **`/app/digests/:id`** — single digest detail
- **`/api/cron`** — full weekly cycle (auth via `CRON_SECRET`)
- **`/api/preview-email/:id`** — inspect what the email actually looks like

Free Gemini key: **https://aistudio.google.com/apikey** — sign in with Google, click "Create API key", paste into `.env`. No billing setup required.

Then click **Fetch + Digest** on any competitor in `/app` — or use the CLI:

```bash
npm run drift -- fetch
npm run drift -- digest vercel.com
```

## CLI

```
drift init-db
drift add <name> <domain>
drift source <competitor> <url> [--kind=pricing|changelog|blog|jobs|docs|homepage|about|other] [--label=…]
drift list
drift fetch [competitor]
drift digest <competitor> [--days=7]
drift digests [competitor]
drift show <digest-id>
drift seed

drift webhook add <competitor> <url> [--kind=slack|discord|generic|email] [--label=…]
drift webhook list [competitor]
drift webhook remove <id>
drift webhook test <competitor>     # re-delivers latest digest

drift remove competitor <selector>
drift remove source <id>
drift remove digest <id>
```

Competitor selectors accept domain, name, or numeric id. Webhook kind is auto-detected from the URL (email address → email, `hooks.slack.com` → slack, etc).

## Delivery

Drift fires every new digest to the webhooks attached to that competitor. Four kinds:

- **Email** — pass `you@example.com`. Requires `RESEND_API_KEY` (free at resend.com, no card). The default sender `onboarding@resend.dev` works without domain verification but can only mail the address that owns the Resend account; verify a domain in Resend to mail anyone else.
- **Slack** — paste an incoming webhook URL from `https://api.slack.com/apps`. Renders as Block Kit with header, urgency context, summary, and a section per bullet group.
- **Discord** — paste a channel webhook URL (channel settings → Integrations → Webhooks). Single embed, color-coded by urgency.
- **Generic** — any HTTP endpoint receives `POST { competitor, digest }` as JSON. For Make / Zapier / n8n / your own endpoint.

Delivery status (last success time, last error) shows in the dashboard and `drift webhook list`. Failed deliveries don't block other webhooks for the same digest.

Preview what an email digest looks like in your browser: `http://localhost:3000/api/preview-email/<digest-id>`.

## Weekly automation

Two ways, pick whichever fits your deploy:

### A. Vercel Cron (zero-server, free tier)

`vercel.json` already declares a Monday 13:00 UTC job hitting `/api/cron`. Push to Vercel, set `GEMINI_API_KEY` and (optionally) `CRON_SECRET` as env vars, and you're done. Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron tick, which the route validates.

> Caveat: Vercel function filesystem is ephemeral. For a free deploy, swap `src/lib/db.ts` to point at **Turso** (free tier, libSQL — SQLite-compatible). Local `node:sqlite` works fine for self-hosted boxes.

### B. CLI cron worker

```bash
npm run cron
```

Iterates every competitor, fetches sources, generates digests, delivers via webhooks. Schedule with:

- **GitHub Actions** — `schedule: cron: '0 13 * * 1'`, then `npm ci && npm run cron`
- **Windows Task Scheduler** — point at `npm run cron`
- **systemd timer** — drop `drift.timer` + `drift.service` in `/etc/systemd/system/`

## Architecture

```
src/
  lib/
    db.ts            node:sqlite + schema migrations
    scraper.ts       fetch + cheerio → visible DOM + JSON-island content + sha256 hash
    synthesizer.ts   Gemini 2.5 Flash with structured output (responseSchema), thinking off
    notify.ts        slack/discord/generic webhooks + resend email
    email.ts         inline-styled HTML + plain text email renderers
    digest.ts        orchestration: fetch → snapshot → synthesize → store → deliver
    types.ts
  bin/
    drift.ts         CLI entry (tsx)
    cron.ts          weekly batch runner
  app/
    page.tsx                       dashboard
    digests/page.tsx               global digest index w/ urgency filter
    digests/[id]/page.tsx          digest detail
    api/cron/route.ts              GET /api/cron — full weekly cycle
    api/preview-email/[id]/route.ts inspect email HTML in browser
    actions.ts                     server actions
    layout.tsx
    globals.css
  vercel.json                      cron config
```

Key choices:
- **`node:sqlite`** instead of better-sqlite3 — no native compile, ships with Node 24+.
- **Gemini 2.5 Flash** with `thinkingConfig.thinkingBudget: 0` — forces direct output, otherwise thinking tokens silently eat the response budget.
- **`responseSchema`** — Gemini is *forced* to return JSON matching the digest shape, no prompt-only adherence required.
- **JSON-island extraction** — `__NEXT_DATA__`, Remix context, Apollo hydration, ld+json all get walked for string values. Without this Linear's changelog scrapes to ~zero useful content; with it, ~55KB.
- **Content-hash dedup** — snapshots only written when SHA256 differs, so the DB stays lean as history compounds.

## Auth

Drift uses a single-admin password-based auth scheme — designed for self-hosting one Drift instance for yourself or a small team.

- `DRIFT_PASSWORD` — set in env. Login form compares against this.
- `DRIFT_AUTH_SECRET` — used to HMAC-sign session cookies. Keep secret. Rotate to log everyone out.
- Sessions live 30 days, stored in an `httpOnly`, `SameSite=Lax`, `Secure` (in prod) cookie.
- Middleware gates `/app/*`. Public routes: `/`, `/demo`, `/login`, `/logout`, `/api/cron` (gated by separate `CRON_SECRET`), `/api/preview-email/*`.
- Leave `DRIFT_PASSWORD` empty for local dev — auth is disabled.

For multi-user / multi-tenant: TODO. Single-admin is enough for self-hosters and indie agencies. Larger teams should add a real IdP (Clerk, WorkOS).

## Deploy free

1. `git init && git remote add … && git push`
2. Connect repo at vercel.com — auto-detects Next.js
3. Add env vars:
   - `GEMINI_API_KEY` (required)
   - `DRIFT_PASSWORD` + `DRIFT_AUTH_SECRET` (required for public deploy)
   - `RESEND_API_KEY` (only if using email delivery)
   - `CRON_SECRET` (recommended, gates `/api/cron`)
4. For persistent state across function invocations: swap `lib/db.ts` to use **Turso** (libSQL — same API surface as `node:sqlite`)

Zero monthly cost, zero card on file, until you have paying customers.

## Roadmap

- [x] Slack / Discord / generic webhook delivery
- [x] Email delivery via Resend
- [x] Vercel-cron-ready API route
- [x] JSON-island extraction for JS-rendered pages
- [x] Delete / manage operations
- [x] Global digests index with urgency filter
- [x] Landing page + public `/demo` + pricing tiers
- [x] Single-admin password auth (deployable publicly)
- [ ] Turso adapter for Vercel free-tier persistence
- [ ] Multi-tenant + magic-link auth (Resend)
- [ ] Stripe Checkout integration
- [ ] Bring-Your-Own-Key tier (Claude / OpenAI) as a paid feature
- [ ] Playwright fallback for fully client-rendered SPAs
- [ ] Sentiment + velocity tracking on G2/Capterra reviews
- [ ] Side-by-side snapshot diff view

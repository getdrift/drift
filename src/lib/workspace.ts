/**
 * Workspace management — creation, lookup, token-based auth.
 *
 * Token storage strategy: never store the plaintext token. We HMAC-hash it
 * with `DRIFT_AUTH_SECRET` and store the hash. Lookup happens by hashing
 * the inbound token and querying the indexed column.
 *
 * Owner workspace (id=1) has token_hash=NULL — auth via DRIFT_PASSWORD only.
 * Customer workspaces always have a token_hash.
 */
import { randomBytes, createHmac } from "node:crypto";
import type { Row } from "@libsql/client";
import { db, OWNER_WORKSPACE_ID } from "./db";
import type { Workspace } from "./types";

const TOKEN_BYTES = 32;

function rowToWorkspace(row: Row): Workspace {
  return row as unknown as Workspace;
}

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(plain: string): string {
  const secret = process.env.DRIFT_AUTH_SECRET || "drift-default-secret-change-me";
  return createHmac("sha256", secret).update(plain).digest("hex");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function uniqueSlug(base: string): Promise<string> {
  const client = await db();
  const root = slugify(base) || "ws";
  // Try the root, then root-2, root-3, … up to 50 attempts.
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const r = await client.execute({
      sql: "SELECT 1 FROM workspaces WHERE slug = ? LIMIT 1",
      args: [candidate],
    });
    if (r.rows.length === 0) return candidate;
  }
  // Fallback to a random suffix.
  return `${root}-${randomBytes(4).toString("hex")}`;
}

export interface CreateWorkspaceInput {
  email: string;
  name?: string;
  plan?: "hosted" | "agency" | "owner";
  stripeCustomerId?: string | null;
  competitorLimit?: number;
  sourceLimitPerCompetitor?: number;
}

export interface CreateWorkspaceResult {
  workspace: Workspace;
  /** Plaintext token. SHOW THIS ONCE to the user — it's never recoverable. */
  plainToken: string;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<CreateWorkspaceResult> {
  const client = await db();
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid email required");
  }
  const name = (input.name ?? deriveName(email)).trim();
  const plan = input.plan ?? "hosted";
  const slug = await uniqueSlug(email.split("@")[0]);

  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);

  const info = await client.execute({
    sql: `INSERT INTO workspaces
            (slug, name, owner_email, plan, token_hash,
             stripe_customer_id, competitor_limit, source_limit_per_competitor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      name,
      email,
      plan,
      tokenHash,
      input.stripeCustomerId ?? null,
      input.competitorLimit ?? 10,
      input.sourceLimitPerCompetitor ?? 5,
    ],
  });
  const id = Number(info.lastInsertRowid);
  const workspace = await findWorkspaceById(id);
  if (!workspace) throw new Error("Failed to create workspace");
  return { workspace, plainToken };
}

function deriveName(email: string): string {
  const local = email.split("@")[0];
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function findWorkspaceById(id: number): Promise<Workspace | null> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM workspaces WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
  return r.rows[0] ? rowToWorkspace(r.rows[0]) : null;
}

export async function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM workspaces WHERE slug = ? AND deleted_at IS NULL",
    args: [slug],
  });
  return r.rows[0] ? rowToWorkspace(r.rows[0]) : null;
}

export async function findWorkspaceByToken(
  plainToken: string,
): Promise<Workspace | null> {
  if (!plainToken || plainToken.length < 16) return null;
  const client = await db();
  const r = await client.execute({
    sql: "SELECT * FROM workspaces WHERE token_hash = ? AND deleted_at IS NULL",
    args: [hashToken(plainToken)],
  });
  return r.rows[0] ? rowToWorkspace(r.rows[0]) : null;
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const client = await db();
  const r = await client.execute(
    "SELECT * FROM workspaces WHERE deleted_at IS NULL ORDER BY id",
  );
  return r.rows.map(rowToWorkspace);
}

export async function softDeleteWorkspace(id: number): Promise<void> {
  if (id === OWNER_WORKSPACE_ID) {
    throw new Error("Cannot delete owner workspace");
  }
  const client = await db();
  await client.execute({
    sql: "UPDATE workspaces SET deleted_at = datetime('now') WHERE id = ?",
    args: [id],
  });
}

/** Re-issue a token for an existing workspace. Returns the new plaintext. */
export async function regenerateToken(id: number): Promise<string> {
  const client = await db();
  const plain = generateToken();
  await client.execute({
    sql: "UPDATE workspaces SET token_hash = ? WHERE id = ?",
    args: [hashToken(plain), id],
  });
  return plain;
}

/**
 * Send the welcome email with a login URL to the workspace owner.
 *
 * Returns true if sent (or skipped because RESEND_API_KEY not configured).
 * Throws on actual Resend API errors so caller can retry.
 */
export async function sendWorkspaceWelcomeEmail(
  workspace: Workspace,
  plainToken: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  }
  if (!workspace.owner_email) {
    return { ok: false, error: "Workspace has no owner_email" };
  }

  const from = process.env.DRIFT_EMAIL_FROM ?? "Drift <onboarding@resend.dev>";
  const siteUrl = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
  const loginUrl = `${siteUrl}/api/login?token=${plainToken}`;

  const subject = `Your Drift workspace is ready, ${workspace.name}`;
  const html = welcomeHtml({ workspace, loginUrl, plainToken });
  const text = welcomeText({ workspace, loginUrl, plainToken });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: workspace.owner_email,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Resend ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function welcomeHtml(opts: {
  workspace: Workspace;
  loginUrl: string;
  plainToken: string;
}): string {
  const { workspace, loginUrl, plainToken } = opts;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Welcome to Drift</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2328;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;max-width:600px;">
        <tr><td style="padding:32px 32px 12px;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-family:ui-monospace,monospace;">drift · welcome</div>
          <h1 style="margin:12px 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">Your Drift workspace is ready.</h1>
          <div style="font-size:12px;color:#6b7280;font-family:ui-monospace,monospace;">workspace: ${escape(workspace.slug)}</div>
        </td></tr>

        <tr><td style="padding:8px 32px 16px;font-size:15px;line-height:1.6;">
          Hi ${escape(workspace.name)},
          <br><br>
          Thanks for subscribing to Drift Hosted. Your private workspace is now provisioned and ready to use.
        </td></tr>

        <tr><td style="padding:8px 32px 24px;">
          <a href="${escape(loginUrl)}" style="display:inline-block;background:#5eead4;color:#0b0d10;font-weight:600;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;">
            Open my dashboard →
          </a>
        </td></tr>

        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;font-size:13px;line-height:1.55;color:#374151;">
          <strong>Bookmark this URL</strong> — that's how you'll sign in from now on:
          <br>
          <code style="display:block;margin-top:6px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:4px;word-break:break-all;font-size:12px;">${escape(loginUrl)}</code>
          <br>
          If you ever lose it, your raw access token is also recoverable on its own:
          <br>
          <code style="display:block;margin-top:6px;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:4px;word-break:break-all;font-size:12px;">${escape(plainToken)}</code>
        </td></tr>

        <tr><td style="padding:20px 32px;font-size:14px;line-height:1.6;">
          <strong>What to do next</strong>
          <ol style="margin:8px 0 0;padding-left:20px;color:#374151;">
            <li>Click "Open my dashboard" above</li>
            <li>Add up to 10 competitor companies + which pages to watch (pricing, changelog, jobs, blog)</li>
            <li>Add at least one delivery destination (Slack/Discord webhook, email, or generic HTTPS)</li>
            <li>The first weekly digest lands next Monday morning</li>
          </ol>
        </td></tr>

        <tr><td style="padding:16px 32px 28px;font-size:13px;color:#6b7280;line-height:1.55;">
          Reply to this email anytime if you hit issues. Cancel anytime via the Stripe link in your receipt — first 30 days are no-questions money-back.
          <br><br>
          — Drift
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function welcomeText(opts: {
  workspace: Workspace;
  loginUrl: string;
  plainToken: string;
}): string {
  const { workspace, loginUrl, plainToken } = opts;
  return [
    `Your Drift workspace is ready, ${workspace.name}.`,
    "",
    `Workspace: ${workspace.slug}`,
    "",
    "Open your dashboard:",
    loginUrl,
    "",
    "Bookmark that URL — it's your sign-in from now on.",
    "",
    `Raw access token (in case you need it standalone): ${plainToken}`,
    "",
    "Next steps:",
    " 1. Click the dashboard URL above",
    " 2. Add up to 10 competitor companies",
    " 3. Add delivery destinations (Slack, Discord, email, webhook)",
    " 4. First weekly digest lands next Monday morning",
    "",
    "Cancel anytime via the Stripe link in your receipt — first 30 days no questions money-back.",
    "",
    "— Drift",
  ].join("\n");
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

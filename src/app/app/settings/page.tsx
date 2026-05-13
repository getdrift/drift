import { requireWorkspace } from "@/lib/session-helpers";
import { OWNER_WORKSPACE_ID } from "@/lib/auth";
import { regenerateTokenAction } from "./actions";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ token_regen?: string }>;
}) {
  const ws = await requireWorkspace();
  const { token_regen } = await searchParams;
  const isOwner = ws.id === OWNER_WORKSPACE_ID;
  const newLoginUrl = token_regen
    ? `${SITE_URL}/api/login?token=${token_regen}`
    : null;

  return (
    <>
      <a href="/app" className="back-link">← back to dashboard</a>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Workspace</h2>
        <dl className="settings-dl">
          <dt>Name</dt>
          <dd>{ws.name}</dd>

          <dt>Plan</dt>
          <dd>
            <span className={`plan-badge plan-${ws.plan}`}>{ws.plan}</span>
            {isOwner ? null : (
              <span style={{ marginLeft: 8, color: "var(--text-faint)", fontSize: 12 }}>
                $19/mo &middot; cancel anytime
              </span>
            )}
          </dd>

          <dt>Account email</dt>
          <dd>{ws.owner_email || <em>not set</em>}</dd>

          <dt>Created</dt>
          <dd>{ws.created_at.slice(0, 10)}</dd>

          <dt>Competitor limit</dt>
          <dd>{ws.competitor_limit >= 999 ? "Unlimited" : `${ws.competitor_limit} competitors`}</dd>

          <dt>Sources per competitor</dt>
          <dd>
            {ws.source_limit_per_competitor >= 999
              ? "Unlimited"
              : `${ws.source_limit_per_competitor} sources each`}
          </dd>

          <dt>Workspace slug</dt>
          <dd><code>{ws.slug}</code></dd>
        </dl>
      </section>

      {newLoginUrl ? (
        <section className="card" style={{ marginTop: 16, border: "1px solid var(--accent)" }}>
          <h2 className="card-title">✓ New access token generated</h2>
          <p style={{ marginTop: 8 }}>
            Bookmark this URL — it&apos;s how you sign in from now on. The previous
            token is no longer valid.
          </p>
          <p
            style={{
              fontFamily: "var(--mono)",
              fontSize: 12,
              padding: 12,
              background: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              wordBreak: "break-all",
            }}
          >
            {newLoginUrl}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-faint)",
              marginTop: 8,
            }}
          >
            We won&apos;t show this again. Refresh the page and it&apos;s gone.
          </p>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Access</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
          You sign in via a private URL containing your access token (the same one
          we emailed you when your workspace was created). If you lose it or want
          to invalidate the old one, regenerate below — the previous token will
          immediately stop working.
        </p>
        <form action={regenerateTokenAction} style={{ marginTop: 12 }}>
          <button type="submit" className="danger">
            Regenerate access token
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Billing &amp; subscription</h2>
        {isOwner ? (
          <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
            This is the owner workspace — not a paid subscription.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-dim)" }}>
              To update your payment method, cancel, or download invoices, open
              the <strong>Stripe receipt email</strong> sent after your purchase
              and click <em>&quot;Manage subscription&quot;</em>. That takes you to
              Stripe&apos;s billing portal — fully self-serve.
            </p>
            <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 8 }}>
              Cancel anytime. We honor a 30-day money-back guarantee on the
              first month — email <a href="mailto:scriptsswiss@gmail.com">scriptsswiss@gmail.com</a>{" "}
              and you&apos;ll get a full refund.
            </p>
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">Get help</h2>
        <p style={{ fontSize: 14, color: "var(--text-dim)" }}>
          Email <a href="mailto:scriptsswiss@gmail.com">scriptsswiss@gmail.com</a>{" "}
          for anything — bugs, feature requests, custom competitor setups, or
          just to say hi. Reply within a business day.
        </p>
      </section>
    </>
  );
}

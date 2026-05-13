import {
  listCompetitors,
  listDigests,
  listSources,
  listWebhooks,
} from "@/lib/digest";
import { requireWorkspace } from "@/lib/session-helpers";
import { OWNER_WORKSPACE_ID } from "@/lib/auth";
import {
  createCompetitorAction,
  createSourceAction,
  createWebhookAction,
  fetchAndDigestAction,
  removeCompetitorAction,
  removeSourceAction,
  removeWebhookAction,
  testWebhooksAction,
} from "../actions";

const KINDS = [
  "homepage",
  "pricing",
  "changelog",
  "blog",
  "docs",
  "jobs",
  "about",
  "other",
];

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ws = await requireWorkspace();
  const workspaceId = ws.id;
  const competitors = await listCompetitors(workspaceId);
  const cards = await Promise.all(
    competitors.map(async (c) => ({
      c,
      sources: await listSources(workspaceId, c.id),
      digests: (await listDigests(workspaceId, c.id)).slice(0, 3),
      webhooks: await listWebhooks(workspaceId, c.id),
    })),
  );

  const totalSources = cards.reduce((acc, c) => acc + c.sources.length, 0);
  const totalDestinations = cards.reduce((acc, c) => acc + c.webhooks.length, 0);
  const isOwner = workspaceId === OWNER_WORKSPACE_ID;
  const competitorLimitLabel =
    ws.competitor_limit >= 999 ? "∞" : String(ws.competitor_limit);

  return (
    <>
      <section className="workspace-header">
        <div className="workspace-header-row">
          <div>
            <div className="workspace-header-name">{ws.name}</div>
            <div className="workspace-header-meta">
              <span className={`plan-badge plan-${ws.plan}`}>{ws.plan}</span>
              <span>
                <strong>{competitors.length}</strong> / {competitorLimitLabel} competitors
              </span>
              <span>
                <strong>{totalSources}</strong> sources
              </span>
              <span>
                <strong>{totalDestinations}</strong> delivery destinations
              </span>
            </div>
          </div>
          <div className="workspace-header-actions">
            <a href="/app/settings" className="btn btn-secondary btn-sm">
              Settings
            </a>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Add competitor</h2>
        <form action={createCompetitorAction} className="add-form">
          <input type="text" name="name" placeholder="Linear" required />
          <input type="text" name="domain" placeholder="linear.app" required />
          <button type="submit">Add</button>
        </form>
      </section>

      {competitors.length === 0 ? (
        <div className="card welcome-card">
          <div className="welcome-eyebrow">welcome to your drift workspace</div>
          <h2 className="welcome-title">
            {isOwner
              ? "Your owner workspace is empty."
              : `Let's get your first brief in your inbox.`}
          </h2>
          <p className="welcome-sub">
            Drift watches competitor pages on a weekly schedule and writes a
            brief on what changed. Four quick steps to get there:
          </p>
          <ol className="welcome-steps-list">
            <li>
              <strong>Add 1–10 competitors</strong> using the form above
              (e.g. <em>Linear</em> / <em>linear.app</em>).
            </li>
            <li>
              <strong>Paste source URLs to track</strong> for each — pricing,
              changelog, jobs, blog, homepage. Up to{" "}
              {ws.source_limit_per_competitor >= 999
                ? "unlimited"
                : ws.source_limit_per_competitor}{" "}
              per competitor.
            </li>
            <li>
              <strong>Add a delivery destination</strong> per competitor — a
              Slack incoming-webhook URL, Discord channel webhook, your email
              address, or any HTTPS endpoint (Zapier / Make / n8n).
            </li>
            <li>
              <strong>Click &quot;Fetch + Digest&quot;</strong> on any
              competitor to generate an instant first brief. After that,
              briefs land every Monday morning automatically.
            </li>
          </ol>
          <p className="welcome-help">
            Stuck or want to talk through your competitor set? Email{" "}
            <a href="mailto:scriptsswiss@gmail.com">scriptsswiss@gmail.com</a>
            {" "}— reply within a business day.
          </p>
        </div>
      ) : null}

      {cards.map(({ c, sources, digests, webhooks }) => {
        return (
          <section key={c.id} className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{c.name}</h2>
                <div className="card-sub">{c.domain}</div>
              </div>
              <div className="card-header-actions">
                <form action={fetchAndDigestAction}>
                  <input type="hidden" name="competitor_id" value={c.id} />
                  <button type="submit">Fetch + Digest</button>
                </form>
                <form action={removeCompetitorAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="danger"
                    aria-label={`Delete ${c.name}`}
                    title={`Delete ${c.name} and all its data`}
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>

            <div className="sources">
              {sources.length === 0 ? (
                <div className="empty">No sources yet.</div>
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="source-line">
                    <span className="kind-badge">{s.kind}</span>
                    <span>{s.label}</span>
                    <span className="spacer" />
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {hostPath(s.url)}
                    </a>
                    <form action={removeSourceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="danger" aria-label="Delete source">
                        ✕
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

            <form action={createSourceAction} className="add-form" style={{ marginTop: 16 }}>
              <input type="hidden" name="competitor_id" value={c.id} />
              <input type="url" name="url" placeholder="https://…" required />
              <select name="kind" defaultValue="other">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input type="text" name="label" placeholder="Label (optional)" />
              <button type="submit" className="secondary">
                + source
              </button>
            </form>

            <div className="webhooks">
              <div className="webhooks-header">
                <span className="section-label">Where briefs go</span>
                {webhooks.length > 0 && digests.length > 0 ? (
                  <form action={testWebhooksAction}>
                    <input type="hidden" name="competitor_id" value={c.id} />
                    <button type="submit" className="link-button">
                      resend latest brief →
                    </button>
                  </form>
                ) : null}
              </div>
              {webhooks.length === 0 ? (
                <div className="empty" style={{ fontSize: 12 }}>
                  No delivery destinations yet. Add your email address, a Slack
                  incoming-webhook URL, a Discord channel webhook, or any HTTPS
                  endpoint (Zapier / Make / n8n) to receive briefs automatically.
                </div>
              ) : (
                webhooks.map((w) => (
                  <div key={w.id} className="webhook-line">
                    <span className="kind-badge">{w.kind}</span>
                    <span>{w.label}</span>
                    <span className="webhook-status">
                      {w.last_error ? (
                        <span className="webhook-error" title={w.last_error}>
                          ✗ error
                        </span>
                      ) : w.last_delivered_at ? (
                        <span className="webhook-ok">
                          ✓ {w.last_delivered_at.slice(0, 16)}
                        </span>
                      ) : (
                        <span className="webhook-pending">pending</span>
                      )}
                    </span>
                    <span className="spacer" />
                    <form action={removeWebhookAction}>
                      <input type="hidden" name="id" value={w.id} />
                      <button type="submit" className="danger" aria-label="Remove destination">
                        ✕
                      </button>
                    </form>
                  </div>
                ))
              )}
              <form action={createWebhookAction} className="add-form" style={{ marginTop: 12 }}>
                <input type="hidden" name="competitor_id" value={c.id} />
                <input
                  type="text"
                  name="url"
                  placeholder="email@you.com   or   https://hooks.slack.com/services/…"
                  required
                />
                <select name="kind" defaultValue="email">
                  <option value="email">email</option>
                  <option value="slack">slack</option>
                  <option value="discord">discord</option>
                  <option value="generic">generic (Zapier / Make / n8n / custom)</option>
                </select>
                <input type="text" name="label" placeholder="Label (optional)" />
                <button type="submit" className="secondary">
                  + delivery destination
                </button>
              </form>
            </div>

            {digests.length > 0 ? (
              <div className="digest-list">
                {digests.map((d) => (
                  <a key={d.id} href={`/app/digests/${d.id}`} className="digest-item">
                    <div className="digest-meta">
                      <span className={`urgency ${d.urgency}`}>{d.urgency}</span>
                      <span>{d.created_at}</span>
                    </div>
                    <div className="summary">{d.body.summary}</div>
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}

function hostPath(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

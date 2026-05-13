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

interface DashboardSearchParams {
  error?: string;
  verify_failed?: string;
  verify_name?: string;
  verify_domain?: string;
  verify_description?: string;
  verify_saw?: string;
  verify_reason?: string;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = (await searchParams) ?? {};
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

      {params.error ? (
        <div className="alert alert-error">
          <strong>⚠</strong> {params.error}
        </div>
      ) : null}

      {params.verify_failed ? (
        <div className="alert alert-warn">
          <div className="alert-head">
            <strong>⚠ We couldn&apos;t verify <code>{params.verify_domain}</code></strong>
          </div>
          <div className="alert-grid">
            <div>
              <div className="alert-label">You said {params.verify_name} is</div>
              <div className="alert-quote">&ldquo;{params.verify_description}&rdquo;</div>
            </div>
            <div>
              <div className="alert-label">We saw at {params.verify_domain}</div>
              <div className="alert-quote">
                {params.verify_saw
                  ? `“${params.verify_saw}”`
                  : "(no readable content)"}
              </div>
            </div>
          </div>
          {params.verify_reason ? (
            <p className="alert-reason">{params.verify_reason}</p>
          ) : null}
          <p className="alert-fix">
            Common fixes: typo in the domain (<code>.com</code> vs <code>.app</code>?),
            the domain redirected to an acquirer, or your description didn&apos;t match
            the actual product. Try again with the form above.
          </p>
        </div>
      ) : null}

      <section className="card">
        <h2 className="card-title">Add competitor</h2>
        <p className="card-sub" style={{ marginBottom: 12 }}>
          We verify each company against its homepage before saving — protects
          your weekly briefs from typo&apos;d domains.
        </p>
        <form action={createCompetitorAction} className="add-form-stacked">
          <div className="add-form-row">
            <input
              type="text"
              name="name"
              placeholder="Linear"
              required
              defaultValue={params.verify_name ?? ""}
            />
            <input
              type="text"
              name="domain"
              placeholder="linear.app"
              required
              defaultValue={params.verify_domain ?? ""}
            />
          </div>
          <input
            type="text"
            name="description"
            placeholder="Project management for product teams (one sentence)"
            required
            maxLength={200}
            minLength={10}
            defaultValue={params.verify_description ?? ""}
          />
          <button type="submit">Verify and add</button>
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
                <h2 className="card-title">
                  {c.name}
                  {c.verified_summary ? (
                    <span
                      className="verified-badge"
                      title={`Verified: ${c.verified_summary}`}
                    >
                      ✓ verified
                    </span>
                  ) : null}
                </h2>
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

            <form action={createSourceAction} className="row-form" style={{ marginTop: 16 }}>
              <input type="hidden" name="competitor_id" value={c.id} />
              <input
                type="url"
                name="url"
                placeholder="https://linear.app/pricing"
                required
                className="row-form-url"
              />
              <div className="row-form-meta">
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
              </div>
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
              <form action={createWebhookAction} className="row-form" style={{ marginTop: 12 }}>
                <input type="hidden" name="competitor_id" value={c.id} />
                <input
                  type="text"
                  name="url"
                  placeholder="you@example.com  ·  https://hooks.slack.com/services/…  ·  discord webhook URL  ·  https://hooks.zapier.com/…"
                  required
                  className="row-form-url"
                />
                <div className="row-form-meta">
                  <select name="kind" defaultValue="email">
                    <option value="email">email</option>
                    <option value="slack">slack</option>
                    <option value="discord">discord</option>
                    <option value="generic">generic webhook</option>
                  </select>
                  <input type="text" name="label" placeholder="Label (optional)" />
                  <button type="submit" className="secondary">
                    + delivery destination
                  </button>
                </div>
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

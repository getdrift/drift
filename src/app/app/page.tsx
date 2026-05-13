import {
  listCompetitors,
  listDigests,
  listSources,
  listWebhooks,
} from "@/lib/digest";
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
  const competitors = await listCompetitors();
  const cards = await Promise.all(
    competitors.map(async (c) => ({
      c,
      sources: await listSources(c.id),
      digests: (await listDigests(c.id)).slice(0, 3),
      webhooks: await listWebhooks(c.id),
    })),
  );

  return (
    <>
      <section className="card">
        <h2 className="card-title">Add competitor</h2>
        <form action={createCompetitorAction} className="add-form">
          <input type="text" name="name" placeholder="Linear" required />
          <input type="text" name="domain" placeholder="linear.app" required />
          <button type="submit">Add</button>
        </form>
      </section>

      {competitors.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-title">No competitors yet</div>
          <div className="empty-body">
            Add one above, or seed with <code>npm run seed</code> for Linear + Vercel.
            Once you have sources, click <strong>Fetch + Digest</strong> to scrape and synthesize
            a weekly brief.
          </div>
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
                <span className="section-label">Delivery</span>
                {webhooks.length > 0 && digests.length > 0 ? (
                  <form action={testWebhooksAction}>
                    <input type="hidden" name="competitor_id" value={c.id} />
                    <button type="submit" className="link-button">
                      resend latest digest →
                    </button>
                  </form>
                ) : null}
              </div>
              {webhooks.length === 0 ? (
                <div className="empty" style={{ fontSize: 12 }}>
                  No webhooks yet. Add an email, Slack, or Discord webhook to receive digests automatically.
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
                      <button type="submit" className="danger" aria-label="Remove webhook">
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
                  <option value="generic">generic</option>
                </select>
                <input type="text" name="label" placeholder="Label (optional)" />
                <button type="submit" className="secondary">
                  + delivery
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

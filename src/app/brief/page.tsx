import type { Metadata } from "next";
import { listDigests, getCompetitor } from "@/lib/digest";
import { DEMO_DIGESTS } from "@/lib/demo-data";
import { stripeHostedUrl } from "@/lib/stripe";
import type { Digest, Competitor } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export const metadata: Metadata = {
  title: "Drift's Weekly Brief — what every B2B SaaS competitor shipped this week",
  description:
    "A public, weekly brief synthesized from real competitor pages — pricing, changelog, hiring, blog. Updated every Monday. Free. No signup.",
  alternates: { canonical: `${SITE_URL}/brief` },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/brief`,
    title: "Drift's Weekly Brief — competitive intel for B2B SaaS",
    description:
      "Real competitor changes, weekly. Pricing, changelog, hiring signals. Free to read.",
  },
};

interface BriefRow {
  digest: Pick<Digest, "id" | "urgency" | "period_start" | "period_end" | "body">;
  competitor: Pick<Competitor, "id" | "name" | "domain"> | undefined;
}

export default async function PublicBrief() {
  const stripeUrl = stripeHostedUrl();
  const rows: BriefRow[] = [];

  try {
    const live = await listDigests();
    for (const d of live.slice(0, 8)) {
      rows.push({ digest: d, competitor: await getCompetitor(d.competitor_id) });
    }
  } catch {
    // DB unavailable — fall through to baked data
  }

  if (rows.length === 0) {
    for (const d of DEMO_DIGESTS.slice(0, 8)) {
      rows.push({ digest: d, competitor: d.competitor });
    }
  }

  const latest = rows[0]?.digest;
  const periodEnd = latest ? new Date(latest.period_end) : new Date();
  const label = weekLabel(periodEnd);

  return (
    <div className="demo">
      <div className="demo-head">
        <div className="hero-eyebrow">drift · public weekly brief · {label}</div>
        <h1 className="demo-title">What B2B SaaS competitors shipped this week.</h1>
        <p className="demo-sub">
          Every Monday, Drift scrapes pricing, changelog, jobs, and blog pages from
          a set of tracked competitors, then writes a brief on what changed and what
          it implies. Below is this week's output, made public. Want this for{" "}
          <em>your</em> competitor set?{" "}
          <a href={stripeUrl}>Subscribe to Hosted ($19/mo)</a> or{" "}
          <a href="https://github.com/getdrift/drift">self-host it free</a>.
        </p>
      </div>

      {rows.map(({ digest: d, competitor: c }) => (
        <article key={d.id} className="demo-digest" id={`brief-${d.id}`}>
          <header className="demo-digest-head">
            <div>
              <h2 className="demo-digest-name">{c?.name ?? "Unknown"}</h2>
              <div className="demo-digest-meta">
                {c?.domain} · {d.period_start.slice(0, 10)} →{" "}
                {d.period_end.slice(0, 10)}
              </div>
            </div>
            <span className={`urgency ${d.urgency}`}>{d.urgency}</span>
          </header>

          <div className="summary-block">{d.body.summary}</div>

          {d.body.key_changes.length > 0 ? (
            <>
              <h3 className="demo-section">Key changes</h3>
              <ul className="demo-list">
                {d.body.key_changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}

          {d.body.hiring_signals && d.body.hiring_signals.length > 0 ? (
            <>
              <h3 className="demo-section">Hiring signals</h3>
              <ul className="demo-list">
                {d.body.hiring_signals.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </>
          ) : null}

          {d.body.strategic_signals.length > 0 ? (
            <>
              <h3 className="demo-section">Strategic signals</h3>
              <ul className="demo-list">
                {d.body.strategic_signals.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}

          {d.body.recommended_actions.length > 0 ? (
            <>
              <h3 className="demo-section">Recommended actions</h3>
              <ul className="demo-list">
                {d.body.recommended_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      ))}

      <section className="demo-cta">
        <h2>Run Drift on your own competitor set.</h2>
        <p
          className="demo-sub"
          style={{ maxWidth: 560, margin: "12px auto 24px" }}
        >
          Hosted is launching once there's enough demand — drop in for $19/mo
          and we run the infra. Or self-host today: it's MIT-licensed, runs on
          any machine (even a $35 Raspberry Pi), with AI inference on a free tier.
        </p>
        <div className="hero-cta" style={{ justifyContent: "center" }}>
          <a href={stripeUrl} className="btn btn-primary">
            Subscribe — $19/mo
          </a>
          <a
            href="https://github.com/getdrift/drift"
            className="btn btn-secondary"
          >
            Self-host on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}

import { listDigests, getCompetitor } from "@/lib/digest";
import { OWNER_WORKSPACE_ID } from "@/lib/auth";
import { DEMO_DIGESTS } from "@/lib/demo-data";
import { stripeHostedUrl } from "@/lib/stripe";
import type { Digest, Competitor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const stripeUrl = stripeHostedUrl();

  let latest: Pick<Digest, "id" | "urgency" | "period_start" | "period_end" | "body"> | undefined;
  let latestCompetitor: Pick<Competitor, "id" | "name" | "domain"> | undefined;
  try {
    const fromDb = (await listDigests(OWNER_WORKSPACE_ID))[0];
    if (fromDb) {
      latest = fromDb;
      latestCompetitor = await getCompetitor(OWNER_WORKSPACE_ID, fromDb.competitor_id);
    }
  } catch {
    // fall through
  }
  if (!latest || !latestCompetitor) {
    const fallback = DEMO_DIGESTS[0];
    if (fallback) {
      latest = fallback;
      latestCompetitor = fallback.competitor;
    }
  }

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-eyebrow">competitive intel · weekly · automated</div>
        <h1 className="hero-title">
          Know what your competitors did this week.
          <br />
          <span className="hero-title-dim">Without checking.</span>
        </h1>
        <p className="hero-sub">
          Drift watches every page that matters — pricing, changelog, jobs, blog.
          Every Monday, an AI-written brief lands in your inbox: what changed,
          what it means, what you should consider doing about it.
        </p>
        <div className="hero-cta">
          <a href="/brief" className="btn btn-primary">
            Read this week's brief →
          </a>
          <a href="/#pricing" className="btn btn-secondary">
            See pricing
          </a>
        </div>
        <div className="hero-trust">
          Free to self-host · Hosted $19/mo · 30-day money-back · No setup
        </div>
      </section>

      {latest && latestCompetitor ? (
        <section className="hero-proof">
          <div className="hero-proof-frame">
            <div className="hero-proof-toolbar">
              <span className="hero-proof-dot" />
              <span className="hero-proof-dot" />
              <span className="hero-proof-dot" />
              <span className="hero-proof-url">
                from: drift@onboarding.resend.dev · to: you@yourcompany.com
              </span>
            </div>
            <div className="hero-proof-body">
              <div className="hero-proof-tag">
                <span className={`urgency ${latest.urgency}`}>{latest.urgency}</span>
                <span style={{ marginLeft: 8 }}>
                  {latestCompetitor.name} — weekly drift ·{" "}
                  {latest.period_end.slice(0, 10)}
                </span>
              </div>
              <p className="hero-proof-summary">{latest.body.summary}</p>
              {latest.body.key_changes.length > 0 ? (
                <>
                  <div className="hero-proof-section">Key changes</div>
                  <ul className="hero-proof-list">
                    {latest.body.key_changes.slice(0, 3).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <a href="/demo" className="hero-proof-readmore">
                Read full digest →
              </a>
            </div>
          </div>
          <div className="hero-proof-caption">
            ↑ a real digest, scraped + synthesized in seconds
          </div>
        </section>
      ) : null}

      <section className="features">
        <div className="feature">
          <div className="feature-icon">⊕</div>
          <h3>Tracks every page that matters</h3>
          <p>
            Pricing, changelog, jobs, docs, blog, homepage. Handles JS-rendered
            sites by parsing hydration data, not just visible DOM.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">≈</div>
          <h3>Signal not noise</h3>
          <p>
            Filters rotating testimonials, footer dates, marketing fluff. Surfaces
            price changes, new tiers, hiring patterns, deprecations.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">→</div>
          <h3>Delivers where you read</h3>
          <p>
            Email (Resend), Slack Block Kit, Discord embeds, or any webhook.
            Pick one per competitor or all four.
          </p>
        </div>
        <div className="feature">
          <div className="feature-icon">$</div>
          <h3>Free forever for solo</h3>
          <p>
            Free AI inference. Self-host on any machine — Raspberry Pi, VPS,
            Vercel free tier. Resend free emails. You can run Drift without
            ever paying anyone.
          </p>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="section-title">How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h4>Paste competitor URLs</h4>
            <p>
              Add 5 competitors. For each, list the pages worth watching — usually
              pricing, changelog, and jobs.
            </p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h4>Drift watches weekly</h4>
            <p>
              Every Monday at 8am, Drift scrapes every page, hashes the content,
              and only flags pages that actually changed.
            </p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h4>The brief lands</h4>
            <p>
              An advanced AI model diffs old vs new and writes a 5-bullet brief — what changed,
              what it implies, what to consider doing. In your inbox.
            </p>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <h2 className="section-title">Pricing</h2>
        <p className="section-sub">
          Three ways in: clone it free, subscribe to hosted, or talk to us if you need custom.
        </p>
        <div className="plans">
          <div className="plan">
            <div className="plan-name">Self-host</div>
            <div className="plan-price">$0</div>
            <div className="plan-cadence">forever, MIT</div>
            <ul className="plan-list">
              <li>Unlimited competitors</li>
              <li>Unlimited weekly digests</li>
              <li>All delivery channels</li>
              <li>Your AI provider key (free tier covers it)</li>
              <li>Your data, your hardware</li>
            </ul>
            <a href="https://github.com/getdrift/drift" className="btn btn-secondary plan-cta">
              Clone the repo
            </a>
          </div>
          <div className="plan plan-featured">
            <div className="plan-tag">most popular</div>
            <div className="plan-name">Hosted</div>
            <div className="plan-price">$19</div>
            <div className="plan-cadence">/ month</div>
            <ul className="plan-list">
              <li>10 competitors, 5 sources each</li>
              <li>Weekly digest, all channels</li>
              <li>We run the infra on a Pi in Switzerland</li>
              <li>30-day money-back guarantee</li>
              <li>Cancel anytime</li>
            </ul>
            <a
              href={stripeUrl}
              className="btn btn-primary plan-cta"
            >
              Subscribe
            </a>
            <p className="plan-note">
              Launch deal: use code <code>FOUNDER10</code> at checkout → $9/mo for life (first 10 customers)
            </p>
          </div>
          <div className="plan">
            <div className="plan-name">Agency</div>
            <div className="plan-price">Custom</div>
            <div className="plan-cadence">talk to us</div>
            <ul className="plan-list">
              <li>White-label briefs</li>
              <li>Multiple client workspaces</li>
              <li>API access</li>
              <li>Priority email support</li>
              <li>Built to your spec</li>
            </ul>
            <a href="/waitlist?plan=agency" className="btn btn-secondary plan-cta">
              Get in touch
            </a>
          </div>
        </div>
        <p className="section-sub" style={{ marginTop: 32, fontSize: 13, opacity: 0.7 }}>
          Prices in USD · 30-day refund on first month · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
        </p>
      </section>

      <section className="footer-cta">
        <h2>Start watching this Monday.</h2>
        <div className="hero-cta" style={{ justifyContent: "center" }}>
          <a href="/brief" className="btn btn-primary">
            This week's brief
          </a>
          <a href="/#pricing" className="btn btn-secondary">
            See pricing
          </a>
        </div>
      </section>
    </div>
  );
}

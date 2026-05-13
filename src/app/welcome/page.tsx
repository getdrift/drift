import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "scriptsswiss@gmail.com";

export const metadata: Metadata = {
  title: "Welcome to Drift",
  description: "Subscription confirmed. Your workspace is being provisioned.",
  robots: { index: false, follow: false },
};

export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  const hasSession = !!session;

  return (
    <div className="login-wrap">
      <div className="card login-card" style={{ maxWidth: 560 }}>
        <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
          ✓ subscription confirmed
        </div>
        <h1 className="login-title">Welcome to Drift.</h1>
        <p className="login-sub">
          {hasSession
            ? "Your Drift Hosted subscription is active. Here's what happens next."
            : "Thanks for stopping by. If you've just subscribed, your workspace setup is in motion — check your email for the login link."}
        </p>

        <div className="welcome-steps">
          <div className="welcome-step">
            <div className="welcome-step-num">1</div>
            <div>
              <strong>Workspace provisioning</strong>
              <p>
                I&apos;ll personally set up your private Drift workspace on the Pi
                within the next 24 hours. (Faster, usually — I get a Stripe
                notification on payment.)
              </p>
            </div>
          </div>
          <div className="welcome-step">
            <div className="welcome-step-num">2</div>
            <div>
              <strong>Login email</strong>
              <p>
                You&apos;ll receive an email at the address you paid with, containing
                a private login URL and an access token. Bookmark the URL — that&apos;s
                how you sign in from then on.
              </p>
            </div>
          </div>
          <div className="welcome-step">
            <div className="welcome-step-num">3</div>
            <div>
              <strong>Add competitors + delivery destinations</strong>
              <p>
                In your dashboard, paste up to 10 competitor pages (pricing,
                changelog, jobs, blog — your choice). Then add where briefs
                should go: Slack webhook, Discord webhook, email, or any HTTPS
                webhook for Zapier/Make/n8n.
              </p>
            </div>
          </div>
          <div className="welcome-step">
            <div className="welcome-step-num">4</div>
            <div>
              <strong>Monday morning</strong>
              <p>
                Every Monday, Drift scrapes, synthesizes a brief with the latest
                changes + hiring signals, and delivers to your destinations.
                That&apos;s it.
              </p>
            </div>
          </div>
        </div>

        <div className="welcome-faq">
          <h2 className="welcome-faq-title">Anything else?</h2>
          <dl>
            <dt>I haven&apos;t received my login email yet</dt>
            <dd>
              Allow 24 hours. If it&apos;s been longer, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your
              Stripe receipt and I&apos;ll fix it the same day.
            </dd>

            <dt>How do I cancel?</dt>
            <dd>
              Open the Stripe-hosted Customer Portal link from your receipt
              email, or email me. You stay subscribed until the end of your
              current billing period.
            </dd>

            <dt>Want a refund?</dt>
            <dd>
              First 30 days, no questions asked — email me. After that, refunds
              are case-by-case.
            </dd>

            <dt>Where do my briefs land?</dt>
            <dd>
              Wherever you configure in the dashboard. We don&apos;t pick — your
              Slack channel, Discord channel, inbox, Zapier webhook, anything
              that accepts an HTTPS POST.
            </dd>
          </dl>
        </div>

        {hasSession ? (
          <p
            className="login-hint"
            style={{ marginTop: 24, fontFamily: "var(--mono)", fontSize: 11 }}
          >
            Reference: <code>{session}</code>
            <br />
            Keep this for support — it&apos;s your Stripe session ID.
          </p>
        ) : null}

        <div
          className="hero-cta"
          style={{ justifyContent: "center", marginTop: 24 }}
        >
          <a href="/brief" className="btn btn-secondary">
            Read this week&apos;s brief
          </a>
          <a href="/" className="btn btn-primary">
            ← back to home
          </a>
        </div>
      </div>
    </div>
  );
}

import { joinWaitlistAction } from "./actions";

export const dynamic = "force-dynamic";

const PLAN_COPY: Record<
  string,
  { name: string; price: string; pitch: string }
> = {
  pro: {
    name: "Hosted",
    price: "$19 / month",
    pitch:
      "10 competitors, weekly digest across email + Slack + Discord + webhooks. We run the infra so you don't paste any API keys.",
  },
  agency: {
    name: "Agency",
    price: "$49 / month",
    pitch:
      "30 competitors, multiple workspaces, white-label deliveries, API access, priority support.",
  },
  other: {
    name: "Just exploring",
    price: "",
    pitch:
      "Drop your email and tell us what you'd want — we'll let you know when it's live.",
  },
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const planKey = params.plan && PLAN_COPY[params.plan] ? params.plan : "pro";
  const plan = PLAN_COPY[planKey];

  if (params.submitted) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
            ✓ you're on the list
          </div>
          <h1 className="login-title">Thanks.</h1>
          <p className="login-sub">
            We'll email you the moment <strong>{plan.name}</strong> opens up. In
            the meantime, the self-host build is fully working and free — clone
            the repo and you can run your own Drift today.
          </p>
          <div
            className="hero-cta"
            style={{ justifyContent: "center", marginTop: 16 }}
          >
            <a href="/brief" className="btn btn-secondary">
              Read this week's brief
            </a>
            <a href="/" className="btn btn-primary">
              ← back to home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card login-card" style={{ maxWidth: 480 }}>
        <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
          waitlist · {plan.name.toLowerCase()}
        </div>
        <h1 className="login-title">{plan.price ? plan.price : plan.name}</h1>
        <p className="login-sub">{plan.pitch}</p>

        <form
          action={joinWaitlistAction}
          className="login-form"
          style={{ marginTop: 16 }}
        >
          <input type="hidden" name="plan" value={planKey} />
          <input
            type="email"
            name="email"
            placeholder="you@yourcompany.com"
            required
            autoFocus
            autoComplete="email"
          />
          <input
            type="text"
            name="name"
            placeholder="Your name (optional)"
            autoComplete="name"
          />
          <input
            type="text"
            name="message"
            placeholder="Anything specific you want to track? (optional)"
          />
          <button type="submit" className="btn btn-primary">
            Join the waitlist
          </button>
        </form>

        {params.error === "invalid-email" ? (
          <div className="login-error">
            Please enter a valid email address.
          </div>
        ) : null}

        <p className="login-hint">
          We&apos;ll only email you about Drift. No newsletter, no upsells.
          Hosted launches when there&apos;s enough demand to justify the infra.
        </p>
      </div>
    </div>
  );
}

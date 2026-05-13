import { joinWaitlistAction } from "./actions";

export const dynamic = "force-dynamic";

interface PlanCopy {
  /** Header eyebrow text (e.g. "agency inquiry") */
  eyebrow: string;
  /** Big title shown above the form */
  title: string;
  /** Pitch paragraph below the title */
  pitch: string;
  /** Submit button label */
  submitLabel: string;
  /** Optional richer extra field's placeholder (set null to hide the field) */
  messagePlaceholder: string | null;
  /** Confirmation page eyebrow */
  thanksEyebrow: string;
  /** Confirmation page title */
  thanksTitle: string;
  /** Confirmation page body */
  thanksBody: string;
  /** Footer disclaimer */
  footer: string;
}

const PLAN_COPY: Record<string, PlanCopy> = {
  pro: {
    eyebrow: "waitlist · hosted $19/mo",
    title: "Get notified about Drift Hosted updates",
    pitch:
      "Hosted is live for buyers via Stripe — but if you'd rather wait, drop your email and we'll ping you with feature updates, price changes, and any free-month windows.",
    submitLabel: "Add me to the list",
    messagePlaceholder: "Anything specific you want to track? (optional)",
    thanksEyebrow: "✓ on the list",
    thanksTitle: "Thanks — you're in.",
    thanksBody:
      "We'll email you about meaningful Drift Hosted updates. No newsletter, no upsells. If you change your mind and want to subscribe today, head back to the homepage and click Subscribe.",
    footer:
      "We'll only email you about Drift. No newsletter, no upsells.",
  },
  agency: {
    eyebrow: "agency inquiry · custom pricing",
    title: "Let's talk.",
    pitch:
      "For PR/marketing agencies, growth consultancies, and teams managing competitor sets for multiple clients. Pricing and features are tailored — tell us what you're tracking, how many clients, and we'll reply within a business day.",
    submitLabel: "Send my inquiry",
    messagePlaceholder:
      "How many clients? Any specific competitor sets? White-label needs? (the more the better)",
    thanksEyebrow: "✓ inquiry received",
    thanksTitle: "Thanks — we'll be in touch.",
    thanksBody:
      "We'll reply within one business day with next steps. If you don't see an email, check spam — and if it doesn't show up at all, hit scriptsswiss@gmail.com directly.",
    footer:
      "Real human reply within a business day. No newsletter, no spam.",
  },
  other: {
    eyebrow: "waitlist · just exploring",
    title: "Tell us what you'd want.",
    pitch:
      "Drop your email and tell us what you'd want from Drift — we'll let you know when it's a fit.",
    submitLabel: "Add me to the list",
    messagePlaceholder: "What would you want from Drift? (optional)",
    thanksEyebrow: "✓ on the list",
    thanksTitle: "Thanks for the heads up.",
    thanksBody:
      "We'll email you when Drift evolves in a direction that matches what you described.",
    footer: "We'll only email you about Drift. No newsletter, no upsells.",
  },
};

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const planKey =
    params.plan && PLAN_COPY[params.plan] ? params.plan : "pro";
  const plan = PLAN_COPY[planKey];

  if (params.submitted) {
    return (
      <div className="login-wrap">
        <div className="card login-card">
          <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
            {plan.thanksEyebrow}
          </div>
          <h1 className="login-title">{plan.thanksTitle}</h1>
          <p className="login-sub">{plan.thanksBody}</p>
          <div
            className="hero-cta"
            style={{ justifyContent: "center", marginTop: 16 }}
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

  return (
    <div className="login-wrap">
      <div className="card login-card" style={{ maxWidth: 520 }}>
        <div className="hero-eyebrow" style={{ marginBottom: 16 }}>
          {plan.eyebrow}
        </div>
        <h1 className="login-title">{plan.title}</h1>
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
          {plan.messagePlaceholder ? (
            planKey === "agency" ? (
              <textarea
                name="message"
                placeholder={plan.messagePlaceholder}
                rows={4}
                style={{ resize: "vertical", minHeight: 80 }}
              />
            ) : (
              <input
                type="text"
                name="message"
                placeholder={plan.messagePlaceholder}
              />
            )
          ) : null}
          <button type="submit" className="btn btn-primary">
            {plan.submitLabel}
          </button>
        </form>

        {params.error === "invalid-email" ? (
          <div className="login-error">
            Please enter a valid email address.
          </div>
        ) : null}

        <p className="login-hint">{plan.footer}</p>
      </div>
    </div>
  );
}

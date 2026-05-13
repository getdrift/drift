import type { Metadata } from "next";

export const dynamic = "force-static";

const SITE_URL = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
const LAST_UPDATED = "May 13, 2026";
const LEGAL_NAME = "[YOUR FULL LEGAL NAME]";
const BUSINESS_ADDRESS = "[BUSINESS POSTAL ADDRESS]";
const CONTACT_EMAIL = "scriptsswiss@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy — Drift",
  description:
    "How Drift collects, uses, and protects your data. Swiss DSG + GDPR compliant.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function Privacy() {
  return (
    <div className="legal-page">
      <header className="legal-head">
        <div className="hero-eyebrow">legal · privacy policy</div>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="legal-body">
        <p>
          This Privacy Policy describes how Drift collects, uses, and protects
          personal data. We comply with the Swiss Federal Act on Data Protection
          (FADP / DSG) and, where applicable, the EU General Data Protection
          Regulation (GDPR).
        </p>

        <h2>1. Who we are (data controller)</h2>
        <p>
          {LEGAL_NAME}
          <br />
          {BUSINESS_ADDRESS}
          <br />
          Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          We are the data controller for the personal data we process about
          you. You can contact us at the email above for any data-related
          question or request.
        </p>

        <h2>2. What data we collect</h2>
        <p>We collect and process the following categories of personal data:</p>

        <h3>From paying customers</h3>
        <ul>
          <li>
            <strong>Account email:</strong> the email you provide at checkout,
            used to send your login link and any service notices.
          </li>
          <li>
            <strong>Payment data:</strong> handled entirely by Stripe — we
            never see your card number or CVC. Stripe gives us your name,
            email, country, last-4-digits of your card, and subscription
            status.
          </li>
          <li>
            <strong>Workspace content:</strong> competitor URLs you configure,
            delivery destinations (Slack webhook URLs, email addresses you
            specify, etc.), and any settings you enter.
          </li>
          <li>
            <strong>Session cookies:</strong> a single HMAC-signed cookie used
            to keep you logged in. Functional only — no advertising or
            tracking cookies.
          </li>
        </ul>

        <h3>From all visitors (including the free site)</h3>
        <ul>
          <li>
            <strong>Server logs:</strong> IP address, user agent, and pages
            visited. Used solely for security and abuse prevention. Retained
            for ninety (90) days, then deleted.
          </li>
        </ul>

        <h3>From the waitlist form</h3>
        <ul>
          <li>
            <strong>Email and optional name + message:</strong> used only to
            notify you when the plan you registered interest in becomes
            available.
          </li>
        </ul>

        <h2>3. Why we process this data (legal basis)</h2>
        <p>
          Under GDPR, the legal bases for processing your data are:
        </p>
        <ul>
          <li>
            <strong>Contract (Art. 6(1)(b)):</strong> processing your account
            and workspace data to deliver the service you purchased.
          </li>
          <li>
            <strong>Legal obligation (Art. 6(1)(c)):</strong> retaining
            payment records for tax and accounting purposes (Swiss law
            requires ten years).
          </li>
          <li>
            <strong>Legitimate interest (Art. 6(1)(f)):</strong> server
            logs for security and abuse prevention.
          </li>
          <li>
            <strong>Consent (Art. 6(1)(a)):</strong> the waitlist signup is
            opt-in; you can withdraw at any time by emailing us.
          </li>
        </ul>

        <h2>4. Third parties we share data with</h2>
        <p>We use a small number of carefully chosen processors:</p>

        <table className="legal-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Data shared</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <a href="https://stripe.com/privacy">Stripe</a>
              </td>
              <td>Payment processing &amp; subscription management</td>
              <td>Email, name, payment method, country, IP</td>
              <td>EU + US (Standard Contractual Clauses)</td>
            </tr>
            <tr>
              <td>
                <a href="https://resend.com/legal/privacy-policy">Resend</a>
              </td>
              <td>Sending account &amp; brief emails</td>
              <td>Email address, message body</td>
              <td>US (Standard Contractual Clauses)</td>
            </tr>
            <tr>
              <td>
                <a href="https://policies.google.com/privacy">
                  Google (Gemini API)
                </a>
              </td>
              <td>AI synthesis of competitor briefs</td>
              <td>
                The text content of competitor pages you ask us to monitor.{" "}
                <strong>Not</strong> your account email or payment data.
              </td>
              <td>US (Google enterprise terms)</td>
            </tr>
            <tr>
              <td>
                <a href="https://tailscale.com/privacy-policy">Tailscale</a>
              </td>
              <td>
                Public HTTPS tunnel from our Pi to the internet (Funnel)
              </td>
              <td>IP addresses of visitors (passed through, not retained)</td>
              <td>US</td>
            </tr>
          </tbody>
        </table>

        <p>
          We do not sell your data, share it with advertisers, or use it to
          train any AI model. If we ever change processors, this list is
          updated.
        </p>

        <h2>5. Where your data is stored</h2>
        <p>
          The core Drift database (your workspace, competitors, snapshots,
          digests, settings) is stored on a Raspberry Pi physically located in
          Switzerland. The Pi runs on a residential connection; we operate
          standard security hygiene but acknowledge this is not a SOC-2
          datacenter. For workspaces that require enterprise-grade hosting,
          please consider self-hosting on your own infrastructure.
        </p>

        <h2>6. How long we keep your data</h2>
        <ul>
          <li>
            <strong>Workspace data:</strong> for as long as your subscription
            is active, plus 30 days after cancellation in case you reactivate.
            Then permanently deleted.
          </li>
          <li>
            <strong>Server logs:</strong> 90 days, then deleted.
          </li>
          <li>
            <strong>Waitlist signups:</strong> kept until you ask us to remove
            them, or until the plan you registered interest in launches and we
            email you about it.
          </li>
          <li>
            <strong>Payment records:</strong> kept for 10 years per Swiss tax
            law (Code of Obligations Art. 958f).
          </li>
        </ul>

        <h2>7. Your rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> the personal data we hold about you.
          </li>
          <li>
            <strong>Correct</strong> data that is inaccurate.
          </li>
          <li>
            <strong>Delete</strong> your data (&quot;right to be forgotten&quot;) —
            with exceptions for data we are legally required to retain.
          </li>
          <li>
            <strong>Export</strong> your data in a machine-readable format.
          </li>
          <li>
            <strong>Object</strong> to certain processing.
          </li>
          <li>
            <strong>Withdraw consent</strong> at any time for any processing
            based on consent.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will
          respond within thirty (30) days.
        </p>
        <p>
          You also have the right to lodge a complaint with the Swiss Federal
          Data Protection and Information Commissioner (FDPIC) at{" "}
          <a href="https://www.edoeb.admin.ch">edoeb.admin.ch</a>, or with
          your local EU supervisory authority if you are an EU resident.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Drift uses one functional cookie only: an HMAC-signed session cookie
          used to keep you logged in. It is essential for the service to
          function and is exempt from consent requirements under the EU
          ePrivacy Directive and Swiss FADP. We do not use any advertising,
          tracking, analytics, or third-party cookies on the marketing site.
        </p>

        <h2>9. International data transfers</h2>
        <p>
          Some of our processors (Stripe, Resend, Google) are based in the
          United States. Where data is transferred outside Switzerland or the
          EEA, we rely on the Standard Contractual Clauses approved by the
          European Commission and recognized by the Swiss FDPIC as providing
          an adequate level of protection.
        </p>

        <h2>10. Security</h2>
        <p>
          We protect your data with TLS in transit, HMAC-signed sessions, and
          access controls limiting workspace data to its owner. No system is
          perfectly secure; if a breach occurs that meaningfully affects you,
          we will notify you within seventy-two (72) hours per GDPR Art. 33.
        </p>

        <h2>11. Children</h2>
        <p>
          Drift is a business tool not directed at anyone under the age of
          sixteen (16). We do not knowingly collect data from children. If we
          learn we have, we will delete it.
        </p>

        <h2>12. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The updated
          version will appear here with a new &quot;Last updated&quot; date.
          For material changes affecting paying customers, we will also email
          you at least thirty (30) days before the change takes effect.
        </p>

        <h2>13. Contact</h2>
        <p>
          For any privacy question, request, or concern, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </div>
  );
}

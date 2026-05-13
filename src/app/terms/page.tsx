import type { Metadata } from "next";

export const dynamic = "force-static";

const SITE_URL = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";
const LAST_UPDATED = "May 13, 2026";
const LEGAL_NAME = "Francis Jego";
const BUSINESS_ADDRESS = "Hammergut 14, 6330 Cham, Switzerland";
const CONTACT_EMAIL = "scriptsswiss@gmail.com";

export const metadata: Metadata = {
  title: "Terms of Service — Drift",
  description:
    "The legal agreement between Drift and its customers. Plain-English Swiss-law terms covering subscription, refunds, and acceptable use.",
  alternates: { canonical: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function Terms() {
  return (
    <div className="legal-page">
      <header className="legal-head">
        <div className="hero-eyebrow">legal · terms of service</div>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-meta">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="legal-body">
        <h2>1. Who we are</h2>
        <p>
          Drift (&quot;Drift&quot;, &quot;we&quot;, &quot;us&quot;) is a software service
          operated by {LEGAL_NAME} as a sole proprietor under Swiss law, with
          postal address at {BUSINESS_ADDRESS}. You can reach us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>2. What Drift does</h2>
        <p>
          Drift scrapes publicly available competitor web pages on a weekly
          schedule, uses an artificial-intelligence model to summarize what
          changed since the previous snapshot, and delivers the resulting brief
          to delivery channels you configure (email, Slack, Discord, or any HTTP
          webhook). Drift is offered in two ways:
        </p>
        <ul>
          <li>
            <strong>Self-host (free):</strong> the source code is published at{" "}
            <a href="https://github.com/getdrift/drift">github.com/getdrift/drift</a>{" "}
            under the MIT License. You install and operate it yourself on your
            own hardware. We provide no support, no SLA, and no warranties for
            self-hosted deployments.
          </li>
          <li>
            <strong>Hosted (paid subscription):</strong> we operate Drift on our
            own infrastructure, give you a private workspace and login, and
            deliver weekly briefs to the destinations you configure. These
            Terms govern Hosted use.
          </li>
        </ul>

        <h2>3. Accounts & access</h2>
        <p>
          To use Hosted Drift, you must purchase a subscription. After payment
          succeeds, we will email you within forty-eight (48) hours with a login
          URL and a one-time access token. You are responsible for keeping that
          token confidential. You must not share access with anyone outside your
          organization without our written consent.
        </p>
        <p>
          You must be at least eighteen (18) years old to purchase a
          subscription, or have the consent of a parent or guardian to do so.
        </p>

        <h2>4. Subscription, billing & refunds</h2>
        <p>
          The Hosted plan is billed at the price displayed on{" "}
          <a href="/">our pricing page</a> at the time of your purchase, in US
          Dollars (USD), via Stripe. Subscriptions renew automatically each
          month until cancelled. You can cancel anytime through the Stripe
          Customer Portal — your subscription continues until the end of the
          billing period you have already paid for, then stops.
        </p>
        <p>
          <strong>Money-back guarantee.</strong> If you are not satisfied with
          Drift in your first thirty (30) days, email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
          refund your most recent monthly payment in full, no questions asked.
          After thirty days, refunds are at our sole discretion.
        </p>
        <p>
          Promotional prices (e.g., founder pricing) lock at the discounted
          rate for as long as your subscription remains active and unpaused.
          If you cancel and re-subscribe later, the standard price applies.
        </p>
        <p>
          We may change our prices for future billing periods. We will give you
          at least thirty (30) days&apos; notice by email before any price
          increase that affects you, and you can cancel before it takes effect.
        </p>

        <h2>5. Acceptable use</h2>
        <p>You agree not to use Drift to:</p>
        <ul>
          <li>
            Scrape pages behind authentication, paywall, or any technical
            access control you are not authorized to bypass.
          </li>
          <li>
            Violate the terms of service or robots.txt of the websites you ask
            Drift to monitor.
          </li>
          <li>
            Send Drift-generated briefs to anyone who has not consented to
            receive them (Drift does not contact your end recipients — you do).
          </li>
          <li>
            Reverse-engineer, scrape, or replicate the Hosted service for the
            purpose of building a competing product.
          </li>
          <li>
            Interfere with the operation of the service (excessive scrape
            requests, denial-of-service attempts, etc.).
          </li>
          <li>Use Drift for any unlawful purpose under Swiss or applicable law.</li>
        </ul>
        <p>
          We may suspend or terminate your subscription without refund if you
          violate this section. We try to warn you first when reasonably
          possible.
        </p>

        <h2>6. Your data &amp; content</h2>
        <p>
          You retain all rights to the competitor URLs you configure, the
          delivery destinations you provide, and any data you enter into Drift.
          You grant us a limited license to process that data solely for the
          purpose of operating the service for you.
        </p>
        <p>
          Drift fetches and stores snapshots of the publicly accessible pages
          you point it at. We do not republish or sell those snapshots. They
          are accessible only inside your private workspace.
        </p>
        <p>
          You can export or delete your workspace data anytime by emailing us.
          On cancellation, we retain your workspace data for thirty (30) days
          in case you reactivate, then permanently delete it.
        </p>
        <p>See our <a href="/privacy">Privacy Policy</a> for full details on data handling.</p>

        <h2>7. Intellectual property</h2>
        <p>
          The self-hosted source code at{" "}
          <a href="https://github.com/getdrift/drift">github.com/getdrift/drift</a>{" "}
          is provided under the MIT License — you can read, modify, fork, and
          redistribute it under that license&apos;s terms.
        </p>
        <p>
          The Hosted service itself (this website, our infrastructure, the
          &quot;Drift&quot; name and branding) is our property. The MIT License
          of the open-source code does not grant any right to operate a
          competing &quot;Drift&quot;-branded service.
        </p>
        <p>
          Briefs generated for you by our AI provider are yours to use, share,
          and republish however you like, including commercially.
        </p>

        <h2>8. No SLA &amp; service disclaimers</h2>
        <p>
          Drift Hosted is delivered on a <strong>best-effort basis</strong>. We
          aim for weekly briefs delivered on Monday mornings, but we do not
          guarantee uptime, delivery time, brief quality, or any specific
          outcome. Drift runs on modest hardware in a residential environment;
          power, internet, and hardware failures can and will cause occasional
          disruption.
        </p>
        <p>
          Drift is provided <strong>&quot;as is&quot; and &quot;as available&quot;</strong>,
          without warranty of any kind, express or implied — including, but not
          limited to, warranties of merchantability, fitness for a particular
          purpose, accuracy of the AI-generated briefs, or non-infringement.
        </p>
        <p>
          The briefs are generated by an artificial-intelligence model and may
          contain inaccuracies, hallucinations, or omissions. You should not
          rely on them as the sole input for any commercial, legal, or
          investment decision. You verify before you act.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by Swiss law, our total liability to
          you for any claim arising out of or relating to these Terms or the
          service is limited to the total amount you paid us in the twelve (12)
          months immediately preceding the event giving rise to the claim.
        </p>
        <p>
          We are not liable for indirect, incidental, consequential, special,
          or punitive damages — including lost profits, lost revenue, lost
          opportunities, or damage to reputation — even if we were advised of
          the possibility.
        </p>
        <p>
          Nothing in this section limits liability that cannot be limited under
          Swiss mandatory consumer-protection law.
        </p>

        <h2>10. Termination</h2>
        <p>
          You can terminate your subscription anytime via the Stripe Customer
          Portal. We can terminate or suspend your subscription for breach of
          these Terms, non-payment, or if continuing to provide the service to
          you becomes legally or operationally impossible. If we terminate
          without cause, we refund any unused portion of your current billing
          period prorated.
        </p>

        <h2>11. Changes to these Terms</h2>
        <p>
          We may update these Terms occasionally. We will post the new version
          here with an updated &quot;Last updated&quot; date, and for any
          material change we will email you at least thirty (30) days before
          it takes effect. Continued use after the effective date constitutes
          acceptance.
        </p>

        <h2>12. Governing law &amp; jurisdiction</h2>
        <p>
          These Terms are governed by the laws of Switzerland, without regard
          to its conflict-of-laws rules. Disputes will be resolved exclusively
          by the competent courts of the canton in which our registered address
          is located, subject to any mandatory consumer-protection forum rules
          applicable to your residence.
        </p>

        <h2>13. Contact</h2>
        <p>
          {LEGAL_NAME}
          <br />
          {BUSINESS_ADDRESS}
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>
    </div>
  );
}

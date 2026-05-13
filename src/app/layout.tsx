import type { Metadata } from "next";
import { cookies } from "next/headers";
import { authDisabled, SESSION_COOKIE, verifySession } from "@/lib/auth";
import "./globals.css";

const SITE_URL = process.env.PUBLIC_URL ?? "https://drift.gibbon-brill.ts.net";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Drift — Weekly competitive intel for B2B SaaS",
  description:
    "Drift watches every competitor page that matters — pricing, changelog, jobs. Every Monday, an AI-written brief lands in your inbox: what changed, what it means, what to do about it.",
  keywords: [
    "competitive intelligence",
    "competitor monitoring",
    "SaaS",
    "pricing tracker",
    "changelog tracker",
    "weekly digest",
    "B2B",
    "AI brief",
  ],
  authors: [{ name: "Drift" }],
  creator: "Drift",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Drift",
    title: "Drift — Weekly competitive intel for B2B SaaS",
    description:
      "Watches your competitors' pricing, changelog & jobs pages. Monday brief: what changed, what it means, what to do.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drift — Weekly competitive intel for B2B SaaS",
    description:
      "Watches your competitors' pricing, changelog & jobs pages. Monday brief in your inbox.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  const authed = !!session || authDisabled();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Drift",
      description:
        "Drift watches your competitors' pricing, changelog, jobs, and blog pages. Every Monday, an AI-written brief lands in your inbox: what changed, what it means, what to do.",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      offers: [
        {
          "@type": "Offer",
          name: "Self-host",
          price: "0",
          priceCurrency: "USD",
          description: "Self-host on your own hardware. MIT-licensed, free forever.",
        },
        {
          "@type": "Offer",
          name: "Hosted",
          price: "19",
          priceCurrency: "USD",
          description: "10 competitors, weekly digest across all channels. Waitlist open — launches with demand.",
        },
        {
          "@type": "Offer",
          name: "Agency",
          price: "49",
          priceCurrency: "USD",
          description: "30 competitors, multiple workspaces, white-label, API access. Waitlist open.",
        },
      ],
      featureList: [
        "Competitor pricing tracking",
        "Changelog monitoring",
        "Hiring-signal analysis",
        "Weekly AI-written brief",
        "Email, Slack, Discord, webhook delivery",
        "Self-hostable on a Raspberry Pi",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Drift",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/demo`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Drift",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: [],
    },
  ];

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <header className="site-header">
          <div className="site-header-inner">
            <a href="/" className="site-logo" aria-label="Drift home">
              <svg width="28" height="28" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="14" cy="32" r="6" fill="#5eead4" opacity="0.25" />
                <circle cx="32" cy="32" r="6" fill="#5eead4" opacity="0.55" />
                <circle cx="50" cy="32" r="6" fill="#5eead4" opacity="1" />
              </svg>
              <span>drift</span>
            </a>
            <nav className="nav">
              <a href="/brief">Brief</a>
              <a href="/demo">Demo</a>
              <a href="/#pricing">Pricing</a>
              <a href="https://github.com/getdrift/drift">GitHub</a>
              {authed ? (
                <>
                  <a href="/app/digests">Digests</a>
                  <a href="/app" className="nav-cta">
                    Dashboard
                  </a>
                  {!authDisabled() ? (
                    <a href="/logout" className="nav-logout" title="Sign out">
                      Sign out
                    </a>
                  ) : null}
                </>
              ) : (
                <a href="/login" className="nav-cta">
                  Sign in
                </a>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="site-footer-left">
              <span className="site-footer-mark">drift</span>
              <span className="site-footer-sub">
                weekly competitive intel · free, MIT, self-hostable
              </span>
            </div>
            <div className="site-footer-links">
              <a href="/brief">This week's brief</a>
              <a href="/demo">Demo</a>
              <a href="/waitlist?plan=pro">Waitlist</a>
              <a href="https://github.com/getdrift/drift">GitHub</a>
              <a href="https://x.com/drift_intel">@drift_intel</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

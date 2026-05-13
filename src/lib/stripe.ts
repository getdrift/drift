/**
 * Stripe URL configuration — single source of truth for the Hosted
 * subscription Payment Link.
 *
 * Swap between Stripe **test** and **live** modes by setting
 * `STRIPE_HOSTED_URL` in `.env` on the deployment target, then restarting
 * the Drift service. No rebuild needed — these are server-rendered.
 *
 * If unset, falls back to the live Payment Link.
 */
export function stripeHostedUrl(): string {
  return (
    process.env.STRIPE_HOSTED_URL ??
    "https://buy.stripe.com/4gM9AL0HI77gauR9kIg3605"
  );
}

/**
 * True if the configured Stripe URL is a test-mode link. Used to render a
 * visible "TEST MODE" banner so we don't accidentally launch socially with
 * a test URL still live.
 */
export function isStripeTestMode(): boolean {
  return stripeHostedUrl().includes("/test_");
}

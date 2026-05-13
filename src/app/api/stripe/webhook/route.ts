/**
 * Stripe webhook handler.
 *
 * Configure in Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *   URL:    https://drift.gibbon-brill.ts.net/api/stripe/webhook
 *   Events: customer.subscription.deleted, customer.subscription.updated,
 *           invoice.payment_failed, invoice.payment_succeeded
 *
 * Signing secret goes in .env as STRIPE_WEBHOOK_SECRET.
 *
 * On `customer.subscription.deleted` / `invoice.payment_failed` → flip the
 * matched workspace's `subscription_active` to 0 so the cron stops
 * delivering. On `customer.subscription.updated` with status active again
 * (e.g. card recovered) → flip back to 1.
 *
 * Workspaces are matched by `stripe_customer_id` (set via the CLI
 * `drift workspace add ... --stripe-customer=cus_xxx`).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  findWorkspaceByStripeCustomerId,
  setSubscriptionState,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeSubscriptionLike };
}

interface StripeSubscriptionLike {
  customer?: string;
  status?: string;
  // invoice.* events
  subscription?: string;
}

function verifySignature(payload: string, header: string, secret: string): boolean {
  // Stripe sends: "t=<timestamp>,v1=<signature>"
  const parts = header.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  if (!parts.t || !parts.v1) return false;

  // Reject events older than 5 minutes (replay protection)
  const ts = Number(parts.t);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - ts;
  if (ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${payload}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(parts.v1, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature") ?? "";
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  // Raw body needed for HMAC — read once, verify, then JSON-parse.
  const raw = await req.text();
  if (!verifySignature(raw, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const obj = event.data.object;
  const customerId = typeof obj.customer === "string" ? obj.customer : null;

  if (!customerId) {
    // No customer ref in this event — ignore, ack to stop retries.
    return NextResponse.json({ received: true, ignored: "no customer" });
  }

  const workspace = await findWorkspaceByStripeCustomerId(customerId);
  if (!workspace) {
    // Workspace not yet linked to this Stripe customer — ignore but ack.
    // The owner can link via:
    //   drift workspace stripe-link <slug> <customer_id>
    return NextResponse.json({
      received: true,
      ignored: "workspace not linked",
      customer: customerId,
      event: event.type,
    });
  }

  switch (event.type) {
    case "customer.subscription.deleted":
      await setSubscriptionState(workspace.id, false, "canceled");
      break;

    case "invoice.payment_failed":
      await setSubscriptionState(workspace.id, false, "past_due");
      break;

    case "invoice.payment_succeeded":
      // Recovered from past_due
      await setSubscriptionState(workspace.id, true, "active");
      break;

    case "customer.subscription.updated":
      const status = obj.status ?? "active";
      const active = status === "active" || status === "trialing";
      await setSubscriptionState(workspace.id, active, status);
      break;

    default:
      // Unknown event type — log and ack
      return NextResponse.json({
        received: true,
        ignored: "unhandled event type",
        event: event.type,
      });
  }

  return NextResponse.json({
    received: true,
    workspace: workspace.slug,
    event: event.type,
  });
}

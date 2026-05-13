import type { Competitor, Digest, Webhook, WebhookKind } from "./types";
import { renderEmailHtml, renderEmailSubject, renderEmailText } from "./email";

const URGENCY_COLORS: Record<string, number> = {
  high: 0xf87171,
  medium: 0xfbbf24,
  low: 0x6b7280,
};

const URGENCY_EMOJI: Record<string, string> = {
  high: ":rotating_light:",
  medium: ":warning:",
  low: ":pushpin:",
};

export interface DeliveryResult {
  webhook_id: number;
  ok: boolean;
  status: number;
  error?: string;
}

export async function deliver(
  webhook: Webhook,
  competitor: Competitor,
  digest: Digest,
): Promise<DeliveryResult> {
  if (!webhook.enabled) {
    return { webhook_id: webhook.id, ok: false, status: 0, error: "disabled" };
  }
  if (webhook.kind === "email") {
    return deliverEmail(webhook, competitor, digest);
  }
  return deliverHttpWebhook(webhook, competitor, digest);
}

/**
 * Send a small test message to a freshly-added webhook to verify it works.
 * Used by createWebhookAction immediately after saving — catches typo'd URLs
 * before the customer's first real Monday brief.
 */
export async function testDelivery(webhook: Webhook): Promise<DeliveryResult> {
  const note =
    "✓ Drift connected. Your competitive intel briefs will land here every week. (This is a one-time test from the dashboard.)";

  try {
    if (webhook.kind === "slack") {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note }),
      });
      if (!res.ok) {
        const t = await res.text();
        return {
          webhook_id: webhook.id,
          ok: false,
          status: res.status,
          error: `HTTP ${res.status}: ${t.slice(0, 200)}`,
        };
      }
      return { webhook_id: webhook.id, ok: true, status: res.status };
    }

    if (webhook.kind === "discord") {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: note }),
      });
      if (!res.ok) {
        const t = await res.text();
        return {
          webhook_id: webhook.id,
          ok: false,
          status: res.status,
          error: `HTTP ${res.status}: ${t.slice(0, 200)}`,
        };
      }
      return { webhook_id: webhook.id, ok: true, status: res.status };
    }

    if (webhook.kind === "generic") {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "drift.test",
          message: note,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return {
          webhook_id: webhook.id,
          ok: false,
          status: res.status,
          error: `HTTP ${res.status}: ${t.slice(0, 200)}`,
        };
      }
      return { webhook_id: webhook.id, ok: true, status: res.status };
    }

    if (webhook.kind === "email") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return {
          webhook_id: webhook.id,
          ok: false,
          status: 0,
          error: "RESEND_API_KEY not configured — skipping test (real briefs may still fail).",
        };
      }
      const from = process.env.DRIFT_EMAIL_FROM ?? "Drift <onboarding@resend.dev>";
      const to = webhook.url.replace(/^mailto:/, "").trim();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: "✓ Drift delivery test",
          text: note,
          html: `<p>${note}</p>`,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return {
          webhook_id: webhook.id,
          ok: false,
          status: res.status,
          error: `Resend ${res.status}: ${t.slice(0, 200)}`,
        };
      }
      return { webhook_id: webhook.id, ok: true, status: res.status };
    }

    return {
      webhook_id: webhook.id,
      ok: false,
      status: 0,
      error: `Unknown webhook kind: ${webhook.kind}`,
    };
  } catch (e) {
    return {
      webhook_id: webhook.id,
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function deliverHttpWebhook(
  webhook: Webhook,
  competitor: Competitor,
  digest: Digest,
): Promise<DeliveryResult> {
  const payload = formatPayload(webhook.kind, competitor, digest);

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        webhook_id: webhook.id,
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    return { webhook_id: webhook.id, ok: true, status: res.status };
  } catch (e) {
    return {
      webhook_id: webhook.id,
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function deliverEmail(
  webhook: Webhook,
  competitor: Competitor,
  digest: Digest,
): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      webhook_id: webhook.id,
      ok: false,
      status: 0,
      error: "RESEND_API_KEY not set — sign up free at resend.com",
    };
  }

  const to = webhook.url.replace(/^mailto:/, "").trim();
  const from = process.env.DRIFT_EMAIL_FROM ?? "Drift <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: renderEmailSubject(competitor, digest),
        html: renderEmailHtml(competitor, digest),
        text: renderEmailText(competitor, digest),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        webhook_id: webhook.id,
        ok: false,
        status: res.status,
        error: `Resend ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { webhook_id: webhook.id, ok: true, status: res.status };
  } catch (e) {
    return {
      webhook_id: webhook.id,
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function formatPayload(kind: WebhookKind, c: Competitor, d: Digest): object {
  switch (kind) {
    case "slack":
      return formatSlack(c, d);
    case "discord":
      return formatDiscord(c, d);
    case "email":
    case "generic":
      return formatGeneric(c, d);
  }
}

function formatSlack(c: Competitor, d: Digest) {
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${URGENCY_EMOJI[d.urgency] ?? ""} ${c.name} — weekly drift`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*${d.urgency.toUpperCase()}* • ${d.period_start.slice(0, 10)} → ${d.period_end.slice(0, 10)} • <${competitorUrl(c)}|${c.domain}>`,
        },
      ],
    },
    { type: "section", text: { type: "mrkdwn", text: d.body.summary } },
  ];

  pushBullets(blocks, "Key changes", d.body.key_changes);
  pushBullets(blocks, "Strategic signals", d.body.strategic_signals);
  pushBullets(blocks, "Recommended actions", d.body.recommended_actions);

  return { blocks };
}

function pushBullets(blocks: object[], title: string, items: string[]) {
  if (items.length === 0) return;
  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${title}*\n${items.map((i) => `• ${i}`).join("\n")}`,
    },
  });
}

function formatDiscord(c: Competitor, d: Digest) {
  const fields: object[] = [];
  if (d.body.key_changes.length > 0) {
    fields.push({
      name: "Key changes",
      value: truncate(d.body.key_changes.map((i) => `• ${i}`).join("\n"), 1024),
    });
  }
  if (d.body.strategic_signals.length > 0) {
    fields.push({
      name: "Strategic signals",
      value: truncate(d.body.strategic_signals.map((i) => `• ${i}`).join("\n"), 1024),
    });
  }
  if (d.body.recommended_actions.length > 0) {
    fields.push({
      name: "Recommended actions",
      value: truncate(d.body.recommended_actions.map((i) => `• ${i}`).join("\n"), 1024),
    });
  }

  return {
    username: "Drift",
    embeds: [
      {
        title: `${c.name} — weekly drift`,
        url: competitorUrl(c),
        description: truncate(d.body.summary, 4000),
        color: URGENCY_COLORS[d.urgency],
        fields,
        footer: {
          text: `${d.urgency.toUpperCase()} • ${d.period_start.slice(0, 10)} → ${d.period_end.slice(0, 10)}`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function formatGeneric(c: Competitor, d: Digest) {
  return {
    competitor: { id: c.id, name: c.name, domain: c.domain },
    digest: {
      id: d.id,
      period_start: d.period_start,
      period_end: d.period_end,
      summary: d.body.summary,
      urgency: d.body.urgency,
      key_changes: d.body.key_changes,
      strategic_signals: d.body.strategic_signals,
      recommended_actions: d.body.recommended_actions,
    },
  };
}

function competitorUrl(c: Competitor): string {
  return c.domain.startsWith("http") ? c.domain : `https://${c.domain}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

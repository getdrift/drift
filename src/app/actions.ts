"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCompetitor,
  addSource,
  addWebhook,
  countCompetitors,
  countSources,
  deliverDigest,
  fetchAllForCompetitor,
  generateDigest,
  getCompetitor,
  listDigests,
  listSources,
  removeCompetitor,
  removeDigest,
  removeSource,
  removeWebhook,
} from "@/lib/digest";
import { requireWorkspace } from "@/lib/session-helpers";
import { verifyCompetitor } from "@/lib/verify-competitor";
import type { WebhookKind } from "@/lib/types";

export async function createCompetitorAction(formData: FormData) {
  const ws = await requireWorkspace();
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();

  if (!name || !domain) {
    redirect(redirectWithError("Name and domain are required"));
  }
  if (!description || description.length < 10) {
    redirect(
      redirectWithError(
        "Describe what this company does (one sentence, 10+ chars). Helps verify the right URL.",
      ),
    );
  }

  // Quota check (failure mode C)
  const current = await countCompetitors(ws.id);
  if (current >= ws.competitor_limit) {
    redirect(
      redirectWithError(
        `You've reached your plan's ${ws.competitor_limit}-competitor limit. Remove one or contact us at scriptsswiss@gmail.com to raise it.`,
      ),
    );
  }

  // Verify the competitor identity via scrape + AI (failure modes 1+9)
  const verdict = await verifyCompetitor({ name, domain, description });

  if (!verdict.ok || !verdict.match) {
    const params = new URLSearchParams();
    params.set("verify_failed", "1");
    params.set("verify_name", name);
    params.set("verify_domain", domain);
    params.set("verify_description", description);
    if (verdict.summary) params.set("verify_saw", verdict.summary);
    if (verdict.mismatch_reason)
      params.set("verify_reason", verdict.mismatch_reason);
    redirect(`/app?${params.toString()}`);
  }

  await addCompetitor(ws.id, name, domain, {
    description,
    verified_summary: verdict.summary,
  });
  revalidatePath("/app");
}

function redirectWithError(message: string): string {
  return `/app?error=${encodeURIComponent(message)}`;
}

export async function createSourceAction(formData: FormData) {
  const ws = await requireWorkspace();
  const competitorId = Number(formData.get("competitor_id"));
  const url = String(formData.get("url") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  const label = String(formData.get("label") ?? "").trim() || titleCase(kind);
  if (!competitorId || !url) return;

  // Quota check on sources-per-competitor
  const current = await countSources(ws.id, competitorId);
  if (current >= ws.source_limit_per_competitor) {
    redirect(
      redirectWithError(
        `That competitor is at the ${ws.source_limit_per_competitor}-source limit. Remove one or email scriptsswiss@gmail.com to raise it.`,
      ),
    );
  }

  await addSource(ws.id, competitorId, url, kind, label);
  revalidatePath("/app");
}

export async function fetchAndDigestAction(formData: FormData) {
  const ws = await requireWorkspace();
  const competitorId = Number(formData.get("competitor_id"));
  if (!competitorId) return;
  const competitor = await getCompetitor(ws.id, competitorId);
  if (!competitor) return;

  // Preflight (failure mode E): can't generate a digest without sources
  const sources = await listSources(ws.id, competitorId);
  if (sources.length === 0) {
    redirect(
      redirectWithError(
        `Add at least one source URL to ${competitor.name} before generating a brief (e.g. their pricing or changelog page).`,
      ),
    );
  }

  await fetchAllForCompetitor(ws.id, competitorId);

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  try {
    const digest = await generateDigest(
      ws.id,
      competitorId,
      start.toISOString(),
      end.toISOString(),
    );
    revalidatePath("/app");
    revalidatePath("/app/digests");
    redirect(`/app/digests/${digest.id}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(redirectWithError(`Couldn't generate brief: ${msg}`));
  }
}

export async function createWebhookAction(formData: FormData) {
  const ws = await requireWorkspace();
  const competitorId = Number(formData.get("competitor_id"));
  const url = String(formData.get("url") ?? "").trim();
  const kind = String(formData.get("kind") ?? "generic") as WebhookKind;
  const label = String(formData.get("label") ?? "").trim() || titleCase(kind);
  if (!competitorId || !url) return;

  // Save first…
  const webhook = await addWebhook(ws.id, competitorId, url, kind, label);

  // …then immediately fire a test ping (failure mode F).
  // Updates last_delivered_at on success or last_error on failure — visible
  // in the UI as the green checkmark or red error indicator.
  const { testDelivery } = await import("@/lib/notify");
  const { db } = await import("@/lib/db");
  const result = await testDelivery(webhook);
  const client = await db();
  const now = new Date().toISOString();
  if (result.ok) {
    await client.execute({
      sql: "UPDATE webhooks SET last_delivered_at = ?, last_error = NULL WHERE id = ?",
      args: [now, webhook.id],
    });
  } else {
    await client.execute({
      sql: "UPDATE webhooks SET last_error = ? WHERE id = ?",
      args: [result.error ?? `HTTP ${result.status}`, webhook.id],
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeWebhookAction(formData: FormData) {
  const ws = await requireWorkspace();
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeWebhook(ws.id, id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeCompetitorAction(formData: FormData) {
  const ws = await requireWorkspace();
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeCompetitor(ws.id, id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeSourceAction(formData: FormData) {
  const ws = await requireWorkspace();
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeSource(ws.id, id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeDigestAction(formData: FormData) {
  const ws = await requireWorkspace();
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeDigest(ws.id, id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function testWebhooksAction(formData: FormData) {
  const ws = await requireWorkspace();
  const competitorId = Number(formData.get("competitor_id"));
  if (!competitorId) return;
  const latest = (await listDigests(ws.id, competitorId))[0];
  if (!latest) return;
  await deliverDigest(ws.id, competitorId, latest.id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

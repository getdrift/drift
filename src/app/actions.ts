"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCompetitor,
  addSource,
  addWebhook,
  deliverDigest,
  fetchAllForCompetitor,
  generateDigest,
  getCompetitor,
  listDigests,
  removeCompetitor,
  removeDigest,
  removeSource,
  removeWebhook,
} from "@/lib/digest";
import type { WebhookKind } from "@/lib/types";

export async function createCompetitorAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  if (!name || !domain) return;
  await addCompetitor(name, domain);
  revalidatePath("/app");
}

export async function createSourceAction(formData: FormData) {
  const competitorId = Number(formData.get("competitor_id"));
  const url = String(formData.get("url") ?? "").trim();
  const kind = String(formData.get("kind") ?? "other");
  const label = String(formData.get("label") ?? "").trim() || titleCase(kind);
  if (!competitorId || !url) return;
  await addSource(competitorId, url, kind, label);
  revalidatePath("/app");
}

export async function fetchAndDigestAction(formData: FormData) {
  const competitorId = Number(formData.get("competitor_id"));
  if (!competitorId) return;
  const competitor = await getCompetitor(competitorId);
  if (!competitor) return;

  await fetchAllForCompetitor(competitorId);

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const digest = await generateDigest(
    competitorId,
    start.toISOString(),
    end.toISOString(),
  );

  revalidatePath("/app");
  revalidatePath("/app/digests");
  redirect(`/app/digests/${digest.id}`);
}

export async function createWebhookAction(formData: FormData) {
  const competitorId = Number(formData.get("competitor_id"));
  const url = String(formData.get("url") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "generic") as WebhookKind);
  const label = String(formData.get("label") ?? "").trim() || titleCase(kind);
  if (!competitorId || !url) return;
  await addWebhook(competitorId, url, kind, label);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeWebhookAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeWebhook(id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeCompetitorAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeCompetitor(id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeSourceAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeSource(id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function removeDigestAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await removeDigest(id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

export async function testWebhooksAction(formData: FormData) {
  const competitorId = Number(formData.get("competitor_id"));
  if (!competitorId) return;
  const latest = (await listDigests(competitorId))[0];
  if (!latest) return;
  await deliverDigest(competitorId, latest.id);
  revalidatePath("/app");
  revalidatePath("/app/digests");
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

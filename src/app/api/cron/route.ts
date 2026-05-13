import {
  fetchAllForCompetitor,
  generateDigest,
  listCompetitors,
} from "@/lib/digest";
import { listWorkspaces } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  type Result = {
    workspace: string;
    competitor: string;
    ok: boolean;
    digest_id?: number;
    urgency?: string;
    error?: string;
  };
  const results: Result[] = [];

  const todayDow = new Date().getUTCDay(); // 0=Sun ... 6=Sat
  const allWorkspaces = await listWorkspaces();
  const skipped: Array<{ workspace: string; reason: string }> = [];

  for (const ws of allWorkspaces) {
    // Per-workspace day-of-week filter — customers pick their own brief day
    if (ws.digest_day_of_week !== todayDow) {
      skipped.push({ workspace: ws.slug, reason: `not scheduled today (day=${ws.digest_day_of_week}, today=${todayDow})` });
      continue;
    }
    // Skip inactive subscriptions — Stripe webhook flips this on cancel/payment-failure
    if (ws.subscription_active === 0) {
      skipped.push({ workspace: ws.slug, reason: `subscription ${ws.subscription_status}` });
      continue;
    }
    const competitors = await listCompetitors(ws.id);
    for (const c of competitors) {
      try {
        await fetchAllForCompetitor(ws.id, c.id);
        const digest = await generateDigest(ws.id, c.id, startIso, endIso);
        results.push({
          workspace: ws.slug,
          competitor: c.name,
          ok: true,
          digest_id: digest.id,
          urgency: digest.urgency,
        });
      } catch (e) {
        results.push({
          workspace: ws.slug,
          competitor: c.name,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return Response.json({
    period: { start: startIso, end: endIso },
    today_dow: todayDow,
    workspaces_total: allWorkspaces.length,
    workspaces_processed: allWorkspaces.length - skipped.length,
    skipped,
    count: results.length,
    results,
  });
}

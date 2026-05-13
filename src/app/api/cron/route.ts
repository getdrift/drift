import {
  fetchAllForCompetitor,
  generateDigest,
  listCompetitors,
} from "@/lib/digest";

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

  const competitors = await listCompetitors();
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  type Result = {
    competitor: string;
    ok: boolean;
    digest_id?: number;
    urgency?: string;
    error?: string;
  };
  const results: Result[] = [];

  for (const c of competitors) {
    try {
      await fetchAllForCompetitor(c.id);
      const digest = await generateDigest(c.id, startIso, endIso);
      results.push({
        competitor: c.name,
        ok: true,
        digest_id: digest.id,
        urgency: digest.urgency,
      });
    } catch (e) {
      results.push({
        competitor: c.name,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    period: { start: startIso, end: endIso },
    count: results.length,
    results,
  });
}

import { getCompetitor, readDigest } from "@/lib/digest";
import { renderEmailHtml } from "@/lib/email";
import { DEMO_DIGESTS } from "@/lib/demo-data";
import type { Competitor, Digest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ digestId: string }> },
) {
  const { digestId } = await ctx.params;
  const id = Number(digestId);

  let digest: Pick<Digest, "id" | "urgency" | "period_start" | "period_end" | "body"> | undefined;
  let competitor: Pick<Competitor, "id" | "name" | "domain"> | undefined;

  // Try DB first
  try {
    const dbDigest = await readDigest(id);
    digest = dbDigest;
    competitor = await getCompetitor(dbDigest.competitor_id);
  } catch {
    // fall through
  }

  // Fall back to baked demo data if DB has no such digest
  if (!digest || !competitor) {
    const fallback = DEMO_DIGESTS.find((d) => d.id === id) ?? DEMO_DIGESTS[0];
    if (fallback) {
      digest = fallback;
      competitor = fallback.competitor;
    }
  }

  if (!digest || !competitor) {
    return new Response("digest not found", { status: 404 });
  }

  return new Response(renderEmailHtml(competitor as Competitor, digest as Digest), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

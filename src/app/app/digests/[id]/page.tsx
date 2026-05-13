import { getCompetitor, readDigest } from "@/lib/digest";
import { requireWorkspaceId } from "@/lib/session-helpers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DigestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await requireWorkspaceId();
  let digest;
  try {
    digest = await readDigest(workspaceId, Number(id));
  } catch {
    notFound();
  }
  const competitor = await getCompetitor(workspaceId, digest.competitor_id);

  return (
    <div className="digest-detail">
      <a href="/app/digests" className="back-link">
        ← all digests
      </a>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">{competitor?.name ?? "Unknown"}</h2>
            <div className="card-sub">
              {digest.period_start.slice(0, 10)} → {digest.period_end.slice(0, 10)}
            </div>
          </div>
          <span className={`urgency ${digest.urgency}`}>{digest.urgency}</span>
        </div>

        <div className="summary-block">{digest.body.summary}</div>

        {digest.body.key_changes.length > 0 ? (
          <>
            <h2>Key changes</h2>
            <ul>
              {digest.body.key_changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        ) : null}

        {digest.body.strategic_signals.length > 0 ? (
          <>
            <h2>Strategic signals</h2>
            <ul>
              {digest.body.strategic_signals.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </>
        ) : null}

        {digest.body.recommended_actions.length > 0 ? (
          <>
            <h2>Recommended actions</h2>
            <ul>
              {digest.body.recommended_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

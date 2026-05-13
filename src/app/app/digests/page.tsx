import { listCompetitors, listDigests } from "@/lib/digest";
import { removeDigestAction } from "../../actions";
import type { Competitor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function DigestsIndex({
  searchParams,
}: {
  searchParams: Promise<{ urgency?: string; competitor?: string }>;
}) {
  return <DigestsList searchParams={searchParams} />;
}

async function DigestsList({
  searchParams,
}: {
  searchParams: Promise<{ urgency?: string; competitor?: string }>;
}) {
  const params = await searchParams;
  const urgencyFilter = params.urgency;
  const competitorFilter = params.competitor ? Number(params.competitor) : undefined;

  const competitors = await listCompetitors();
  const byId = new Map<number, Competitor>(competitors.map((c) => [c.id, c]));

  let digests = await listDigests(competitorFilter);
  if (urgencyFilter && ["high", "medium", "low"].includes(urgencyFilter)) {
    digests = digests.filter((d) => d.urgency === urgencyFilter);
  }

  const counts = {
    high: digests.filter((d) => d.urgency === "high").length,
    medium: digests.filter((d) => d.urgency === "medium").length,
    low: digests.filter((d) => d.urgency === "low").length,
    total: digests.length,
  };

  return (
    <>
      <div className="page-head">
        <h2 className="page-title">All digests</h2>
        <div className="page-meta">{counts.total} total</div>
      </div>

      <div className="filter-bar">
        <FilterPill href="/app/digests" label="all" active={!urgencyFilter} />
        <FilterPill
          href="/app/digests?urgency=high"
          label={`high · ${counts.high}`}
          active={urgencyFilter === "high"}
          tone="high"
        />
        <FilterPill
          href="/app/digests?urgency=medium"
          label={`medium · ${counts.medium}`}
          active={urgencyFilter === "medium"}
          tone="medium"
        />
        <FilterPill
          href="/app/digests?urgency=low"
          label={`low · ${counts.low}`}
          active={urgencyFilter === "low"}
          tone="low"
        />
      </div>

      {digests.length === 0 ? (
        <div className="card empty-card">
          <div className="empty">
            No digests yet. Add a competitor and click <strong>Fetch + Digest</strong>.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {digests.map((d) => {
            const c = byId.get(d.competitor_id);
            return (
              <div key={d.id} className="digest-row">
                <a href={`/app/digests/${d.id}`} className="digest-row-main">
                  <div className="digest-row-head">
                    <span className={`urgency ${d.urgency}`}>{d.urgency}</span>
                    <span className="digest-row-name">{c?.name ?? "Unknown"}</span>
                    <span className="digest-row-domain">{c?.domain}</span>
                    <span className="digest-row-time">{d.created_at}</span>
                  </div>
                  <div className="digest-row-summary">{d.body.summary}</div>
                </a>
                <form action={removeDigestAction} className="digest-row-actions">
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="danger" aria-label="Delete digest">
                    ✕
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterPill({
  href,
  label,
  active,
  tone,
}: {
  href: string;
  label: string;
  active: boolean;
  tone?: "high" | "medium" | "low";
}) {
  const cls = ["filter-pill"];
  if (active) cls.push("active");
  if (tone) cls.push(`tone-${tone}`);
  return (
    <a href={href} className={cls.join(" ")}>
      {label}
    </a>
  );
}

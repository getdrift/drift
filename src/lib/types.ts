export type SourceKind =
  | "homepage"
  | "pricing"
  | "changelog"
  | "blog"
  | "docs"
  | "jobs"
  | "about"
  | "other";

export interface Competitor {
  id: number;
  name: string;
  domain: string;
  created_at: string;
}

export interface Source {
  id: number;
  competitor_id: number;
  url: string;
  kind: SourceKind;
  label: string;
  created_at: string;
}

export interface Snapshot {
  id: number;
  source_id: number;
  content: string;
  content_hash: string;
  fetched_at: string;
}

export type Urgency = "high" | "medium" | "low";

export interface DigestBody {
  summary: string;
  key_changes: string[];
  strategic_signals: string[];
  recommended_actions: string[];
  /** Hiring lane: roles posted + what they imply (e.g. "3 ML engineers → AI feature push"). */
  hiring_signals?: string[];
  urgency: Urgency;
}

export interface Digest {
  id: number;
  competitor_id: number;
  period_start: string;
  period_end: string;
  urgency: Urgency;
  body: DigestBody;
  created_at: string;
}

export type WebhookKind = "slack" | "discord" | "generic" | "email";

export interface Webhook {
  id: number;
  competitor_id: number;
  url: string;
  kind: WebhookKind;
  label: string;
  enabled: number;
  last_delivered_at: string | null;
  last_error: string | null;
  created_at: string;
}

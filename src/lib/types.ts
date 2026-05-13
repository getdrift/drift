export type SourceKind =
  | "homepage"
  | "pricing"
  | "changelog"
  | "blog"
  | "docs"
  | "jobs"
  | "about"
  | "other";

export interface Workspace {
  id: number;
  slug: string;
  name: string;
  owner_email: string;
  plan: "hosted" | "agency" | "owner";
  token_hash: string | null;
  stripe_customer_id: string | null;
  competitor_limit: number;
  source_limit_per_competitor: number;
  /** 0=Sun, 1=Mon, ..., 6=Sat. Day weekly briefs are generated + delivered. */
  digest_day_of_week: number;
  /** 1 if subscription is paid/current. 0 if canceled/past-due — pauses weekly cron. */
  subscription_active: number;
  /** Mirrors Stripe subscription status. 'active' | 'canceled' | 'past_due' | etc. */
  subscription_status: string;
  created_at: string;
  deleted_at: string | null;
}

export interface Competitor {
  id: number;
  workspace_id: number;
  name: string;
  domain: string;
  /** Customer-provided one-line description of what this company does. Used as identity anchor. */
  description: string;
  /** Gemini-generated one-sentence summary based on the actual homepage content at add time. NULL = not yet verified. */
  verified_summary: string | null;
  /** ISO timestamp of last verification. NULL = never verified. */
  verified_at: string | null;
  created_at: string;
}

export interface Source {
  id: number;
  workspace_id: number;
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
  workspace_id: number;
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
  workspace_id: number;
  competitor_id: number;
  url: string;
  kind: WebhookKind;
  label: string;
  enabled: number;
  last_delivered_at: string | null;
  last_error: string | null;
  created_at: string;
}

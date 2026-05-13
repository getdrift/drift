import type { DigestBody, SourceKind, Urgency } from "./types";

const MODEL = process.env.DRIFT_MODEL ?? "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are a competitive-intelligence analyst writing weekly briefs for a B2B SaaS founder.

You will receive a competitor's name and a set of paired "BEFORE" / "AFTER" snapshots of pages on their site (pricing, changelog, blog, jobs, etc.) taken at two points in time.

Your job: identify what actually changed and what it implies. Filter out noise (rotating testimonials, footer dates, copyright years, minor copy tweaks). Surface signal: price changes, new product lines, repositioning, hiring patterns, deprecations, new integrations, partnerships, customer logos.

Rules:
- If nothing material changed, set urgency to "low", key_changes to [], and say so in summary.
- Be specific. "They changed pricing" is useless. "Pro tier dropped from $49 to $39/seat" is signal.
- Each item in key_changes cites a concrete change with concrete details.
- Each item in strategic_signals connects dots across sources.
- Each item in recommended_actions is something the reader should consider doing this week.
- hiring_signals is for jobs-page deltas ONLY. Extract roles posted and connect them to product direction. Examples: "3 ML engineer roles → AI features in Q3", "First DevRel hire → focus shift to developer adoption", "Sales VP in Berlin → EU expansion". If no jobs-page changes, leave as [].
- Max 5 items per array.
- No markdown formatting inside strings.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    key_changes: { type: "ARRAY", items: { type: "STRING" } },
    strategic_signals: { type: "ARRAY", items: { type: "STRING" } },
    recommended_actions: { type: "ARRAY", items: { type: "STRING" } },
    hiring_signals: { type: "ARRAY", items: { type: "STRING" } },
    urgency: { type: "STRING", enum: ["high", "medium", "low"] },
  },
  required: [
    "summary",
    "key_changes",
    "strategic_signals",
    "recommended_actions",
    "hiring_signals",
    "urgency",
  ],
  propertyOrdering: [
    "summary",
    "key_changes",
    "strategic_signals",
    "recommended_actions",
    "hiring_signals",
    "urgency",
  ],
} as const;

export interface SnapshotPair {
  url: string;
  kind: SourceKind;
  label: string;
  before: string | null;
  after: string;
}

export async function synthesize(
  competitorName: string,
  competitorDomain: string,
  periodStart: string,
  periodEnd: string,
  pairs: SnapshotPair[],
): Promise<DigestBody> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it to .env",
    );
  }

  const userText = buildUserMessage(
    competitorName,
    competitorDomain,
    periodStart,
    periodEnd,
    pairs,
  );

  const isThinkingModel = /(2\.5|3\.)/.test(MODEL);
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
    temperature: 0.3,
  };
  if (isThinkingModel) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig,
  };

  const url = `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const finishReason = data.candidates?.[0]?.finishReason;
  if (!text) {
    throw new Error(
      `Gemini returned no content (finish=${finishReason}): ` +
        JSON.stringify(data).slice(0, 500),
    );
  }
  if (finishReason && finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped early (${finishReason}). Try a larger maxOutputTokens. First 200 chars: ${text.slice(0, 200)}`,
    );
  }

  return parseDigest(text);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function buildUserMessage(
  name: string,
  domain: string,
  start: string,
  end: string,
  pairs: SnapshotPair[],
): string {
  const lines: string[] = [];
  lines.push(`Competitor: ${name} (${domain})`);
  lines.push(`Period: ${start} → ${end}`);
  lines.push(`Sources monitored: ${pairs.length}`);
  lines.push("");

  for (const p of pairs) {
    lines.push(`===== SOURCE: ${p.label || p.kind} (${p.kind}) =====`);
    lines.push(`URL: ${p.url}`);
    lines.push("");
    lines.push("--- BEFORE ---");
    lines.push(p.before ? truncate(p.before, 10_000) : "(no prior snapshot)");
    lines.push("");
    lines.push("--- AFTER ---");
    lines.push(truncate(p.after, 10_000));
    lines.push("");
  }

  lines.push("Produce the JSON digest now.");
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

function parseDigest(text: string): DigestBody {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Synthesizer did not return JSON. Got: " + text.slice(0, 300));
  }
  const json = text.slice(start, end + 1);
  const parsed = JSON.parse(json) as Partial<DigestBody>;

  const urgency: Urgency =
    parsed.urgency === "high" || parsed.urgency === "medium" ? parsed.urgency : "low";

  return {
    summary: String(parsed.summary ?? ""),
    key_changes: Array.isArray(parsed.key_changes)
      ? parsed.key_changes.map(String)
      : [],
    strategic_signals: Array.isArray(parsed.strategic_signals)
      ? parsed.strategic_signals.map(String)
      : [],
    recommended_actions: Array.isArray(parsed.recommended_actions)
      ? parsed.recommended_actions.map(String)
      : [],
    hiring_signals: Array.isArray(parsed.hiring_signals)
      ? parsed.hiring_signals.map(String)
      : [],
    urgency,
  };
}

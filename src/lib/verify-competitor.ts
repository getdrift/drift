/**
 * Competitor identity verification.
 *
 * When a customer adds a competitor, we scrape the homepage and ask the
 * AI to confirm the page actually describes the same company the customer
 * claims to track. Catches typos, redirects, and wrong-company adds before
 * any digest is generated.
 *
 * The verified summary becomes a permanent identity anchor — every future
 * weekly synthesis cites it so the AI can flag drift (acquisition,
 * rebrand, hijacked domain).
 */
import { scrape } from "./scraper";

const MODEL = process.env.DRIFT_MODEL ?? "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const VERIFY_SYSTEM_PROMPT = `You verify that a customer's stated competitor matches the actual content of the URL they provided.

You will receive: the customer's claimed name, the domain they entered, and an optional one-line description of what they say the company does. Plus the scraped homepage content.

Your job: in one sentence, describe what the page ACTUALLY shows this company does — based only on the page content, not your training data. Then decide whether the page is plausibly about the same entity the customer described.

Rules:
- summary: one sentence, factual, derived from the page. Mention the product category, target market, and key positioning that you see on the page.
- match: "yes" if the page is plausibly about the company the customer described. "no" if it's clearly a different entity (different industry, unrelated business, parked domain, 404, etc).
- mismatch_reason: required if match="no". One sentence explaining what's wrong.
- Be strict but fair. A close-enough match counts ("Linear" described as "project management" and the page describes "issue tracking for product teams" → yes).
- If the page content is empty, a 404, or clearly broken, match="no" and mismatch_reason explains.`;

const VERIFY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    match: { type: "STRING", enum: ["yes", "no"] },
    mismatch_reason: { type: "STRING" },
  },
  required: ["summary", "match"],
  propertyOrdering: ["summary", "match", "mismatch_reason"],
} as const;

export interface VerifyResult {
  ok: boolean;
  /** One-sentence summary of what the homepage shows. Always populated. */
  summary: string;
  /** True if AI confirmed the homepage matches the customer's claim. */
  match: boolean;
  /** If !match, why. */
  mismatch_reason?: string;
  /** Raw scraped content length, for debugging. */
  scraped_chars: number;
  /** Error if scrape or AI call failed. */
  error?: string;
}

export async function verifyCompetitor(opts: {
  name: string;
  domain: string;
  description: string;
}): Promise<VerifyResult> {
  const { name, domain, description } = opts;

  // 1. Scrape the homepage.
  const url = normalizeHomepage(domain);
  const scraped = await scrape(url);
  if (!scraped.ok) {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: `Could not load the homepage at ${url} (HTTP ${scraped.status}). Double-check the domain.`,
      scraped_chars: 0,
      error: scraped.error,
    };
  }
  if (!scraped.content || scraped.content.length < 100) {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: `The page at ${url} returned almost no content (${scraped.content.length} chars). May be a JS-heavy SPA we can't read, a parked domain, or a blocked scrape.`,
      scraped_chars: scraped.content.length,
    };
  }

  // 2. Ask Gemini to verify.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: "GEMINI_API_KEY not configured on the server.",
      scraped_chars: scraped.content.length,
    };
  }

  const userMessage = [
    `Customer claim:`,
    `  Name: ${name}`,
    `  Domain: ${domain}`,
    `  Says it does: ${description || "(no description provided)"}`,
    ``,
    `Homepage content scraped from ${url}:`,
    `---`,
    truncate(scraped.content, 8000),
    `---`,
    ``,
    `Verify and respond as JSON.`,
  ].join("\n");

  const isThinking = /(2\.5|3\.)/.test(MODEL);
  const body = {
    systemInstruction: { parts: [{ text: VERIFY_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: VERIFY_RESPONSE_SCHEMA,
      maxOutputTokens: 1024,
      temperature: 0.1,
      ...(isThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };

  const fetchUrl = `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: "Could not reach the AI verification service. Try again in a moment.",
      scraped_chars: scraped.content.length,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: `AI verification failed (HTTP ${res.status}). Try again.`,
      scraped_chars: scraped.content.length,
      error: text.slice(0, 500),
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: "AI returned no content. Try again.",
      scraped_chars: scraped.content.length,
    };
  }

  let parsed: { summary?: string; match?: string; mismatch_reason?: string };
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return {
      ok: false,
      summary: "",
      match: false,
      mismatch_reason: "AI returned malformed response. Try again.",
      scraped_chars: scraped.content.length,
    };
  }

  const summary = String(parsed.summary ?? "").trim();
  const match = parsed.match === "yes";
  return {
    ok: true,
    summary,
    match,
    mismatch_reason: match ? undefined : String(parsed.mismatch_reason ?? "Identity mismatch."),
    scraped_chars: scraped.content.length,
  };
}

function normalizeHomepage(domain: string): string {
  let d = domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${d}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + `\n…[truncated]`;
}

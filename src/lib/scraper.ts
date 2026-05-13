import { load, type CheerioAPI } from "cheerio";
import { createHash } from "node:crypto";

const UA =
  "Mozilla/5.0 (compatible; DriftBot/0.1; +https://drift.example/bot)";

export interface ScrapeResult {
  url: string;
  ok: boolean;
  status: number;
  content: string;
  content_hash: string;
  error?: string;
}

export async function scrape(url: string): Promise<ScrapeResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
    });
    const status = res.status;
    if (!res.ok) {
      return {
        url,
        ok: false,
        status,
        content: "",
        content_hash: "",
        error: `HTTP ${status}`,
      };
    }
    const html = await res.text();
    const content = extractText(html);
    const content_hash = createHash("sha256").update(content).digest("hex");
    return { url, ok: true, status, content, content_hash };
  } catch (e) {
    return {
      url,
      ok: false,
      status: 0,
      content: "",
      content_hash: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function extractText(html: string): string {
  const $ = load(html);

  // Extract JSON islands BEFORE we strip <script> tags. These contain
  // the actual content for JS-rendered Next.js / Remix sites where the
  // visible DOM is mostly an app shell.
  const jsonStrings = extractJsonStrings($);

  $(
    "script, style, noscript, svg, iframe, nav, footer, header, form, [aria-hidden='true']",
  ).remove();

  const root = $("main").length
    ? $("main")
    : $("article").length
      ? $("article")
      : $("body");

  const blocks: string[] = [];
  root.find("h1,h2,h3,h4,p,li,td,th,blockquote,pre,code,a,button").each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (!text) return;
    if (tag.startsWith("h")) blocks.push(`\n## ${text}`);
    else if (tag === "li") blocks.push(`- ${text}`);
    else blocks.push(text);
  });

  // Always include JSON-island content. If the visible DOM was thin
  // (JS-rendered shell), this is where the actual page text lives.
  if (jsonStrings.length > 0) {
    blocks.push("\n## structured-data");
    for (const s of jsonStrings) blocks.push(s);
  }

  return dedupe(blocks).join("\n").trim().slice(0, 60_000);
}

function extractJsonStrings($: CheerioAPI): string[] {
  const out: string[] = [];

  // Next.js / Remix data island
  $("script#__NEXT_DATA__, script#__REMIX_CONTEXT__").each((_, el) => {
    const text = $(el).contents().text();
    pushFromJson(text, out);
  });

  // Apollo / TanStack hydration
  $("script[type='application/json']").each((_, el) => {
    const text = $(el).contents().text();
    pushFromJson(text, out);
  });

  // Structured data
  $("script[type='application/ld+json']").each((_, el) => {
    const text = $(el).contents().text();
    pushFromJson(text, out);
  });

  return out;
}

function pushFromJson(text: string, out: string[]) {
  if (!text || text.length > 2_000_000) return;
  try {
    const parsed = JSON.parse(text);
    walkStrings(parsed, out);
  } catch {
    // not JSON, ignore
  }
}

function walkStrings(node: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (typeof node === "string") {
    const s = node.trim().replace(/\s+/g, " ");
    if (!isInteresting(s)) return;
    out.push(s);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) walkStrings(v, out, depth + 1);
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) walkStrings(v, out, depth + 1);
  }
}

function isInteresting(s: string): boolean {
  if (s.length < 12 || s.length > 4000) return false;
  if (/^https?:\/\//.test(s)) return false;
  if (/^[0-9a-f]{16,}$/i.test(s)) return false; // hashes
  if (/^[A-Za-z0-9+/=]{40,}$/.test(s) && !s.includes(" ")) return false; // base64
  if (/^[\w-]+\.(svg|png|jpg|jpeg|webp|ico|gif|woff2?|css|js|json|map)$/i.test(s)) return false;
  if (/^[0-9.]+$/.test(s)) return false; // numbers only
  // require either whitespace (a sentence) or a capital letter (a label/name)
  return /\s/.test(s) || /[A-Z]/.test(s);
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const k = l.toLowerCase().trim();
    if (k.length < 2) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

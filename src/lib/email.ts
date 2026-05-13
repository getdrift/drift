import type { Competitor, Digest } from "./types";

const URGENCY_HEX: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#9aa3ad",
};

export function renderEmailSubject(c: Competitor, d: Digest): string {
  const tag = d.urgency === "high" ? "🚨 " : d.urgency === "medium" ? "⚠️ " : "";
  return `${tag}${c.name} — weekly drift [${d.urgency.toUpperCase()}]`;
}

export function renderEmailText(c: Competitor, d: Digest): string {
  const lines: string[] = [];
  lines.push(`${c.name} — weekly drift`);
  lines.push(`${d.urgency.toUpperCase()} • ${d.period_start.slice(0, 10)} → ${d.period_end.slice(0, 10)}`);
  lines.push("");
  lines.push(d.body.summary);
  lines.push("");
  appendSection(lines, "KEY CHANGES", d.body.key_changes);
  appendSection(lines, "HIRING SIGNALS", d.body.hiring_signals ?? []);
  appendSection(lines, "STRATEGIC SIGNALS", d.body.strategic_signals);
  appendSection(lines, "RECOMMENDED ACTIONS", d.body.recommended_actions);
  return lines.join("\n").trim();
}

function appendSection(lines: string[], title: string, items: string[]) {
  if (items.length === 0) return;
  lines.push(title);
  for (const item of items) lines.push(`  • ${item}`);
  lines.push("");
}

export function renderEmailHtml(c: Competitor, d: Digest): string {
  const accent = URGENCY_HEX[d.urgency] ?? URGENCY_HEX.low;
  const period = `${d.period_start.slice(0, 10)} → ${d.period_end.slice(0, 10)}`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escape(c.name)} — drift</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2328;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;max-width:600px;">
        <tr><td style="padding:24px 28px 8px;border-bottom:1px solid #e5e7eb;">
          <table width="100%"><tr>
            <td style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;font-family:ui-monospace,monospace;">drift · competitive intel</td>
            <td align="right" style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${accent};font-family:ui-monospace,monospace;">${d.urgency}</td>
          </tr></table>
          <h1 style="margin:12px 0 4px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${escape(c.name)}</h1>
          <div style="font-size:12px;color:#6b7280;font-family:ui-monospace,monospace;">${escape(c.domain)} · ${period}</div>
        </td></tr>

        <tr><td style="padding:20px 28px;border-left:3px solid ${accent};background:#f9fafb;">
          <div style="font-size:15px;line-height:1.6;">${escape(d.body.summary)}</div>
        </td></tr>

        ${renderBulletSection("Key changes", d.body.key_changes)}
        ${renderBulletSection("Hiring signals", d.body.hiring_signals ?? [])}
        ${renderBulletSection("Strategic signals", d.body.strategic_signals)}
        ${renderBulletSection("Recommended actions", d.body.recommended_actions)}

        <tr><td style="padding:20px 28px;font-size:11px;color:#9aa3ad;border-top:1px solid #e5e7eb;font-family:ui-monospace,monospace;">
          delivered by drift · digest #${d.id}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderBulletSection(title: string, items: string[]): string {
  if (items.length === 0) return "";
  const lis = items
    .map((i) => `<li style="margin-bottom:6px;line-height:1.55;">${escape(i)}</li>`)
    .join("");
  return `<tr><td style="padding:20px 28px 0;">
    <h2 style="margin:0 0 8px;font-size:14px;font-weight:600;letter-spacing:0.02em;color:#1f2328;">${title}</h2>
    <ul style="margin:0;padding-left:20px;font-size:14px;color:#374151;">${lis}</ul>
  </td></tr>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

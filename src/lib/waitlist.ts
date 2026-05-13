import { db } from "./db";

export interface WaitlistEntry {
  id: number;
  email: string;
  name: string;
  plan: string;
  message: string;
  created_at: string;
}

export async function addWaitlistEntry(
  email: string,
  name: string,
  plan: string,
  message: string,
): Promise<WaitlistEntry | null> {
  try {
    const client = await db();
    const info = await client.execute({
      sql: "INSERT INTO waitlist (email, name, plan, message) VALUES (?, ?, ?, ?)",
      args: [email, name, plan, message],
    });
    const id = Number(info.lastInsertRowid);
    const r = await client.execute({
      sql: "SELECT * FROM waitlist WHERE id = ?",
      args: [id],
    });
    return r.rows[0] ? (r.rows[0] as unknown as WaitlistEntry) : null;
  } catch (e) {
    console.error("[waitlist] db unavailable, falling back to log:", e instanceof Error ? e.message : e);
    console.log("[waitlist] signup:", JSON.stringify({ email, name, plan, message }));
    return null;
  }
}

export async function notifyOwner(entry: {
  email: string;
  name: string;
  plan: string;
  message: string;
}): Promise<void> {
  const ownerEmail = process.env.WAITLIST_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!ownerEmail || !apiKey) return;

  const from = process.env.DRIFT_EMAIL_FROM ?? "Drift <onboarding@resend.dev>";
  const subject = `Drift waitlist: ${entry.email} (${entry.plan})`;
  const body = [
    `New waitlist signup`,
    ``,
    `Email:   ${entry.email}`,
    `Name:    ${entry.name || "(blank)"}`,
    `Plan:    ${entry.plan}`,
    `Message: ${entry.message || "(none)"}`,
  ].join("\n");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: ownerEmail, subject, text: body }),
    });
  } catch (e) {
    console.error("[waitlist] resend notify failed:", e instanceof Error ? e.message : e);
  }
}

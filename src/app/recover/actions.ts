"use server";

import { redirect } from "next/navigation";
import {
  findWorkspacesByEmail,
  regenerateToken,
  sendWorkspaceWelcomeEmail,
} from "@/lib/workspace";

/**
 * Login recovery: customer enters their email → if a workspace exists, we
 * regenerate the access token and email them a fresh login URL.
 *
 * Always responds with "we sent it if it exists" regardless — prevents
 * enumeration attacks (someone fishing for which emails own workspaces).
 */
export async function recoverAccessAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(
      `/recover?error=${encodeURIComponent("Please enter a valid email address.")}`,
    );
  }

  // Look up workspaces by email. There might be multiple (rare, but possible).
  const workspaces = await findWorkspacesByEmail(email);
  // Send one recovery email per matched workspace (each gets its own token).
  for (const ws of workspaces) {
    if (ws.id === 1) continue; // skip owner workspace — auth via password
    const plain = await regenerateToken(ws.id);
    await sendWorkspaceWelcomeEmail(ws, plain);
  }

  // Always redirect to "sent" state — don't reveal whether email exists.
  redirect(`/recover?sent=${encodeURIComponent(email)}`);
}

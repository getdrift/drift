"use server";

import { redirect } from "next/navigation";
import { OWNER_WORKSPACE_ID } from "@/lib/auth";
import { requireWorkspaceId } from "@/lib/session-helpers";
import { regenerateToken } from "@/lib/workspace";

/**
 * Regenerate the workspace access token. The previous token is immediately
 * invalidated. The plaintext new token is passed via URL query — visible
 * only this once, until page refresh.
 *
 * The owner workspace doesn't have a token (it uses password auth), so this
 * is a no-op for OWNER_WORKSPACE_ID.
 */
export async function regenerateTokenAction() {
  const workspaceId = await requireWorkspaceId();
  if (workspaceId === OWNER_WORKSPACE_ID) {
    redirect("/app/settings?error=owner-workspace-uses-password");
  }
  const plain = await regenerateToken(workspaceId);
  redirect(`/app/settings?token_regen=${plain}`);
}

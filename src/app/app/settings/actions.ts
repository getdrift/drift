"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OWNER_WORKSPACE_ID } from "@/lib/auth";
import { requireWorkspaceId } from "@/lib/session-helpers";
import { regenerateToken, setDigestDayOfWeek } from "@/lib/workspace";

/**
 * Regenerate the workspace access token. Previous token immediately invalid.
 * The plaintext new token is passed via URL query — visible only this once.
 */
export async function regenerateTokenAction() {
  const workspaceId = await requireWorkspaceId();
  if (workspaceId === OWNER_WORKSPACE_ID) {
    redirect("/app/settings?error=owner-workspace-uses-password");
  }
  const plain = await regenerateToken(workspaceId);
  redirect(`/app/settings?token_regen=${plain}`);
}

/** Update the day-of-week the workspace's weekly digest is generated. */
export async function setDigestDayAction(formData: FormData) {
  const workspaceId = await requireWorkspaceId();
  const day = Number(formData.get("day_of_week"));
  if (!Number.isFinite(day) || day < 0 || day > 6) {
    redirect("/app/settings?error=invalid-day");
  }
  await setDigestDayOfWeek(workspaceId, day);
  revalidatePath("/app/settings");
  redirect("/app/settings?saved=schedule");
}

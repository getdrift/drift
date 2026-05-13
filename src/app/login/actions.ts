"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authDisabled,
  checkPassword,
  OWNER_WORKSPACE_ID,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth";
import { findWorkspaceByToken } from "@/lib/workspace";

export async function loginAction(formData: FormData) {
  const input = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");

  if (authDisabled()) {
    redirect(next);
  }

  // 1. Admin password path → owner workspace.
  if (checkPassword(input)) {
    await setSession("admin", OWNER_WORKSPACE_ID);
    redirect(next);
  }

  // 2. Customer access-token path → that customer's workspace.
  if (input.length >= 16) {
    const ws = await findWorkspaceByToken(input);
    if (ws) {
      await setSession(`workspace:${ws.slug}`, ws.id);
      redirect(next);
    }
  }

  const params = new URLSearchParams({
    error: "Invalid password or token",
    next,
  });
  redirect(`/login?${params.toString()}`);
}

async function setSession(user: string, workspace_id: number) {
  const token = await signSession(user, workspace_id);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

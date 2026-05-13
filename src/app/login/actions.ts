"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authDisabled,
  checkPassword,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");

  if (authDisabled()) {
    redirect(next);
  }

  if (!checkPassword(password)) {
    const params = new URLSearchParams({ error: "Invalid password", next });
    redirect(`/login?${params.toString()}`);
  }

  const token = await signSession("admin");
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(next);
}

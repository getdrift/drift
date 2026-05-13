"use server";

import { redirect } from "next/navigation";
import { addWaitlistEntry, notifyOwner } from "@/lib/waitlist";

export async function joinWaitlistAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const plan = String(formData.get("plan") ?? "pro").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/waitlist?plan=${encodeURIComponent(plan)}&error=invalid-email`);
  }

  await addWaitlistEntry(email, name, plan, message);
  await notifyOwner({ email, name, plan, message });

  redirect(`/waitlist?plan=${encodeURIComponent(plan)}&submitted=1`);
}

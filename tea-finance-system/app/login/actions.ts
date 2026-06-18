"use server";

import { redirect } from "next/navigation";

import { authenticateUser, clearSession, setSession } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const session = await authenticateUser(username, password);
  if (!session) {
    redirect("/login?error=invalid");
  }
  await setSession(session);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

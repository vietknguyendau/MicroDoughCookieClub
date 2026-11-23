"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export async function loginAction(_prev: { error?: string; email?: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password.", email };
  const res = await login(email, password);
  if (!res.ok) return { error: res.error, email };
  redirect("/admin");
}

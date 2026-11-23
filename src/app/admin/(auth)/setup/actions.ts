"use server";

import { timingSafeEqual, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { clientIp, hashPassword, login } from "@/lib/auth";
import { hashIp, rateLimit } from "@/lib/security";

type State = { error?: string; email?: string; name?: string } | null;

const digest = (s: string) => createHash("sha256").update(s).digest();

export async function setupAction(_prev: State, form: FormData): Promise<State> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const keep = { email, name };

  const rl = await rateLimit(db, "setup", hashIp(await clientIp()), 5, 15 * 60);
  if (!rl.ok) return { error: "Too many attempts. Wait 15 minutes.", ...keep };

  const expected = process.env.ADMIN_SETUP_CODE ?? "";
  const given = String(form.get("code") ?? "");
  if (expected.length < 12 || !timingSafeEqual(digest(given), digest(expected))) {
    return { error: "That setup code isn't right.", ...keep };
  }

  const parsed = z
    .object({
      email: z.email("Enter a valid email"),
      name: z.string().min(1, "Add a name"),
      password: z.string().min(12, "Password must be at least 12 characters").max(200),
    })
    .safeParse({ email, name, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, ...keep };
  if (parsed.data.password !== String(form.get("confirm") ?? "")) return { error: "Passwords don't match.", ...keep };

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await db.transaction(async (tx) => {
    // Serialize concurrent setup attempts, then re-check that no admin exists.
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const existing = await tx.execute<{ n: number }>(sql`select count(*)::int as n from admin_users`);
    if (Number(existing.rows[0].n) > 0) return false;
    await tx.insert(adminUsers).values({ email: parsed.data.email, name: parsed.data.name, passwordHash });
    return true;
  });
  if (!created) return { error: "Setup was already completed. Use the login page." };

  const res = await login(parsed.data.email, parsed.data.password);
  if (!res.ok) redirect("/admin/login");
  redirect("/admin");
}

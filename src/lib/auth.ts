import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { hashIp, rateLimit, sha256 } from "@/lib/security";

export const SESSION_COOKIE = "md_admin";
const SESSION_DAYS = 14;
// Hash of a random string: used so login takes the same time whether or not the email exists.
const DUMMY_HASH = "$2b$12$qUCyVErZcyqfbgf.M1gssO0r18DGQmoqsh8sn2Hhvyl1prMRDrfom";

export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const ip = hashIp(await clientIp());
  const [byIp, byEmail] = await Promise.all([
    rateLimit(db, "login-ip", ip, 10, 15 * 60),
    rateLimit(db, "login-email", sha256(normalized), 5, 15 * 60),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "Too many attempts. Please wait 15 minutes and try again." };

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized)).limit(1);
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { ok: false, error: "That email and password don't match." };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(adminSessions).values({ id: sha256(token), adminId: user.id, expiresAt });
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
  // Opportunistic cleanup of expired sessions
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function getAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminId))
    .where(and(eq(adminSessions.id, sha256(token)), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

/** Call at the top of EVERY admin page, server action, and route handler. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function logout(everywhere = false) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    if (everywhere) {
      const admin = await getAdmin();
      if (admin) await db.delete(adminSessions).where(eq(adminSessions.adminId, admin.id));
    } else {
      await db.delete(adminSessions).where(eq(adminSessions.id, sha256(token)));
    }
  }
  jar.delete(SESSION_COOKIE);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(adminId: string, password: string) {
  const [u] = await db.select({ h: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, adminId));
  return !!u && bcrypt.compare(password, u.h);
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DBorTx } from "@/db/types";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return s;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** IPs are never stored raw — only a salted hash, used for rate limiting. */
export function hashIp(ip: string) {
  return createHmac("sha256", secret()).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

/* ── Form timing token: blocks bots that submit instantly or replay ancient forms ── */

export function issueFormToken(now = Date.now()) {
  const sig = createHmac("sha256", secret()).update(`form:${now}`).digest("base64url").slice(0, 22);
  return `${now}.${sig}`;
}

export type TokenCheck = "ok" | "too_fast" | "invalid";

export function checkFormToken(token: string | undefined | null, minMs: number, now = Date.now()): TokenCheck {
  if (!token) return "invalid";
  const [tsStr, sig] = token.split(".");
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || !sig) return "invalid";
  const expected = createHmac("sha256", secret()).update(`form:${ts}`).digest("base64url").slice(0, 22);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
  const age = now - ts;
  if (age > 12 * 60 * 60 * 1000 || age < -60_000) return "invalid";
  return age < minMs ? "too_fast" : "ok";
}

/* ── Fixed-window rate limiter backed by Postgres (no paid Redis needed) ── */

export async function rateLimit(
  db: DBorTx,
  bucket: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; count: number }> {
  const key = `${bucket}:${identity}`;
  const res = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then now() else rate_limits.window_start end
    returning count
  `);
  const count = Number(res.rows[0]?.count ?? 0);
  return { ok: count <= limit, count };
}

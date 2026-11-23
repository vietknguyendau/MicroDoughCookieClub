import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

/**
 * One small pool per serverless instance, pointed at Neon's *pooled* endpoint
 * (the hostname containing "-pooler"). attachDatabasePool lets Vercel's Fluid
 * compute close idle clients before an instance is suspended, so connections
 * don't leak. This is the pattern Neon + Vercel recommend for node-postgres.
 */
declare global {
  var __mdPool: Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // TLS is configured explicitly below, so drop sslmode/channel_binding from the URL
  // (silences pg's "sslmode aliases" warning without weakening anything).
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("channel_binding");
  const pool = new Pool({
    connectionString: u.toString(),
    max: 5,
    idleTimeoutMillis: 5_000,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
  });
  attachDatabasePool(pool);
  return pool;
}

const pool = globalThis.__mdPool ?? makePool();
if (process.env.NODE_ENV !== "production") globalThis.__mdPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type { DB, Tx } from "./types";
export { schema };

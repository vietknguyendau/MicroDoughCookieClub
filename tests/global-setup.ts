import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// Tests run against a REAL Postgres (never your Neon production DB).
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5433/microdough_test";
  if (/neon\.tech/.test(url) && !process.env.ALLOW_NEON_TESTS) {
    throw new Error("Refusing to wipe a Neon database. Point TEST_DATABASE_URL at a throwaway DB/branch.");
  }
  const pool = new Pool({ connectionString: url });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}

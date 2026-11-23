import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import type { DB } from "@/db/types";

export const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
export const db: DB = drizzle(pool, { schema });

const H = 3600_000;

export async function makeAdmin() {
  const [a] = await db
    .insert(schema.adminUsers)
    .values({ email: `${randomUUID()}@test.dev`, name: "Owner", passwordHash: "x" })
    .returning();
  return a;
}

export async function makeFlavors(n = 3) {
  return db
    .insert(schema.flavors)
    .values(Array.from({ length: n }, (_, i) => ({ name: `Flavor ${i}`, slug: `f-${randomUUID()}` })))
    .returning();
}

/** Event that is live now, entries open, rules approved. */
export async function makeEvent(over: Partial<typeof schema.events.$inferInsert> = {}, flavorIds: string[] = []) {
  const now = Date.now();
  const [ev] = await db
    .insert(schema.events)
    .values({
      slug: `ev-${randomUUID()}`,
      name: "Test Pop-up",
      status: "archived",
      startsAt: new Date(now - H),
      endsAt: new Date(now + H),
      entryOpensAt: new Date(now - H),
      entryClosesAt: new Date(now + 24 * H),
      drawingAt: new Date(now + 25 * H),
      rulesApprovedAt: new Date(now - 2 * H),
      ...over,
    })
    .returning();
  if (flavorIds.length) {
    await db.insert(schema.eventFlavors).values(flavorIds.map((flavorId, i) => ({ eventId: ev.id, flavorId, sortOrder: i })));
  }
  return ev;
}

export const later = (hours: number) => new Date(Date.now() + hours * H);

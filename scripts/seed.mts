/**
 * Seeds the six signature flavors (idempotent — safe to run twice).
 * Photos in seed-assets/ are TEMPORARY crops from Instagram screenshots;
 * replace them in Admin → Flavors with the original photos.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { scriptDb } from "./_db.mts";
import { flavorImages, flavors } from "../src/db/schema.ts";

export const SEED_FLAVORS = [
  { slug: "pandacoco", name: "Pandacoco", description: "Pandan cookie with white chocolate, toasted coconut, and salted coconut cream drizzle." },
  { slug: "corny-crush", name: "Corny Crush", description: "Brown butter sweet corn milk cookie with creamy corn milk center, white chocolate, and crispy cornflake wafer crumble." },
  { slug: "midnight-phin", name: "Midnight Phin", description: "Espresso cookie with dark chocolate, toffee, caramel, and sweetened condensed milk drizzle." },
  { slug: "purple-haze", name: "Purple Haze", description: "Buttery ube milk cookie stuffed with salted milk cream, covered with delicate milk crumbs and gooey toasted marshmallow." },
  { slug: "smore-to-love", name: "S'more to Love", description: "Brown butter milk cookie with dark and semisweet chocolate, cornflake crunchies, and marshmallows." },
  { slug: "sesame-dream", name: "Sesame Dream", description: "Sesame cookie with white chocolate and marshmallows, finished with sweetened condensed milk drizzle." },
];

const { db, pool } = scriptDb();
// Runs on every deploy: only seeds a brand-new database, so flavors Emmy
// deletes or renames later are never brought back.
const existing = await db.select({ id: flavors.id }).from(flavors).limit(1);
if (existing.length) {
  console.log("✓ Flavors already exist — seed skipped");
  await pool.end();
  process.exit(0);
}
for (const [i, f] of SEED_FLAVORS.entries()) {
  const [row] = await db
    .insert(flavors)
    .values({ ...f, sortOrder: i })
    .onConflictDoNothing({ target: flavors.slug })
    .returning({ id: flavors.id });
  if (!row) {
    console.log(`• ${f.name} already exists — skipped`);
    continue;
  }
  const path = `seed-assets/${f.slug}.webp`;
  if (existsSync(path)) {
    await db.insert(flavorImages).values({ flavorId: row.id, mimeType: "image/webp", data: await readFile(path) });
    await db.update(flavors).set({ imageVersion: 1 }).where(eq(flavors.id, row.id));
  }
  console.log(`✓ ${f.name}`);
}
await pool.end();

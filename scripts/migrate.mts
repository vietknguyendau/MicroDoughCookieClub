import { migrate } from "drizzle-orm/node-postgres/migrator";
import { scriptDb } from "./_db.mts";

const { db, pool } = scriptDb();
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✓ Migrations applied");
await pool.end();

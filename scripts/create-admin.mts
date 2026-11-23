/**
 * Creates (or resets the password of) an owner account.
 *   npm run admin:create -- owner@example.com "Her Name"
 * You'll be prompted for the password, so it never lands in shell history.
 */
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { scriptDb } from "./_db.mts";
import { adminUsers } from "../src/db/schema.ts";

const [email, ...nameParts] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error('Usage: npm run admin:create -- owner@example.com "Owner Name"');
  process.exit(1);
}
const password = process.env.ADMIN_PASSWORD ?? (await (async () => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const p = await rl.question("Password (12+ characters): ");
  rl.close();
  return p;
})());
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
const { db, pool } = scriptDb();
const passwordHash = await bcrypt.hash(password, 12);
await db
  .insert(adminUsers)
  .values({ email: email.toLowerCase(), name: nameParts.join(" ") || "Owner", passwordHash })
  .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash } });
console.log(`✓ Admin ready: ${email.toLowerCase()}`);
await pool.end();

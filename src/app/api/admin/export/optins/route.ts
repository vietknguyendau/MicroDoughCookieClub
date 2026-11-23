import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, giveawayEntries } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** Only people who ticked the optional marketing box. Nothing is sent automatically. */
export async function GET() {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const rows = await db
    .select({ firstName: giveawayEntries.firstName, email: giveawayEntries.email, phone: giveawayEntries.phone, event: events.name, at: giveawayEntries.createdAt })
    .from(giveawayEntries)
    .innerJoin(events, eq(events.id, giveawayEntries.eventId))
    .where(eq(giveawayEntries.marketingOptIn, true))
    .orderBy(desc(giveawayEntries.createdAt));
  const csv = toCsv([["first_name", "email", "phone", "opted_in_at_event", "opted_in_at_utc"], ...rows.map((r) => [r.firstName, r.email, r.phone, r.event, r.at.toISOString()])]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="microdough-optins-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

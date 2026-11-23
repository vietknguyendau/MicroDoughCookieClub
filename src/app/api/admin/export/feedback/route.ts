import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, flavorRatings, flavorVotes, flavors, surveyResponses } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** One row per cookie rating (anonymous — no contact info in this export). */
export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const ev = new URL(req.url).searchParams.get("event");
  const eventId = ev && /^[0-9a-f-]{36}$/i.test(ev) ? ev : null;
  const fav = sql<string | null>`(select f2.name from flavors f2 where f2.id = ${flavorVotes.favoriteFlavorId})`;
  const rows = await db
    .select({
      responseId: surveyResponses.id,
      submittedAt: surveyResponses.createdAt,
      event: events.name,
      flavor: flavors.name,
      stars: flavorRatings.stars,
      buyAgain: flavorRatings.buyAgain,
      favorite: fav,
      suggestion: flavorVotes.nextFlavorSuggestion,
      comments: surveyResponses.comments,
    })
    .from(flavorRatings)
    .innerJoin(surveyResponses, eq(surveyResponses.id, flavorRatings.responseId))
    .innerJoin(events, eq(events.id, surveyResponses.eventId))
    .innerJoin(flavors, eq(flavors.id, flavorRatings.flavorId))
    .leftJoin(flavorVotes, eq(flavorVotes.responseId, surveyResponses.id))
    .where(eventId ? eq(surveyResponses.eventId, eventId) : undefined)
    .orderBy(surveyResponses.createdAt);

  const csv = toCsv([
    ["response_id", "submitted_at_utc", "event", "flavor", "stars", "buy_again", "favorite", "bake_next_suggestion", "comments"],
    ...rows.map((r) => [r.responseId, r.submittedAt.toISOString(), r.event, r.flavor, r.stars, r.buyAgain, r.favorite, r.suggestion, r.comments]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="microdough-feedback-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db/types";
import { eventFlavors, flavorRatings, flavorVotes, surveyResponses } from "@/db/schema";
import { surveySchema, type SurveyInput } from "@/lib/validation";
import { feedbackOpen, getPublicEvent } from "./events";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Saves one anonymous survey (response + per-flavor ratings + vote) atomically.
 * Nothing here references giveaway entries — feedback stays anonymous and can
 * never influence anyone's odds.
 */
export async function submitSurvey(db: DB, raw: SurveyInput, now = new Date()): Promise<SubmitResult> {
  const parsed = surveySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid survey" };
  const input = parsed.data;

  const ev = await getPublicEvent(db, input.eventSlug);
  if (!ev) return { ok: false, error: "We couldn't find that pop-up." };
  if (!feedbackOpen(ev, now)) return { ok: false, error: "Feedback for this pop-up is closed." };

  const flavorIds = input.ratings.map((r) => r.flavorId);
  const offered = await db
    .select({ flavorId: eventFlavors.flavorId })
    .from(eventFlavors)
    .where(and(eq(eventFlavors.eventId, ev.id), inArray(eventFlavors.flavorId, flavorIds)));
  if (offered.length !== flavorIds.length) {
    return { ok: false, error: "One of those cookies wasn't on this pop-up's menu." };
  }

  await db.transaction(async (tx) => {
    const [resp] = await tx
      .insert(surveyResponses)
      .values({ eventId: ev.id, comments: input.comments })
      .returning({ id: surveyResponses.id });
    await tx.insert(flavorRatings).values(
      input.ratings.map((r) => ({
        responseId: resp.id,
        eventId: ev.id,
        flavorId: r.flavorId,
        stars: r.stars,
        buyAgain: r.buyAgain,
      })),
    );
    if (input.favoriteFlavorId || input.nextFlavorSuggestion) {
      await tx.insert(flavorVotes).values({
        responseId: resp.id,
        eventId: ev.id,
        favoriteFlavorId: input.favoriteFlavorId ?? null,
        nextFlavorSuggestion: input.nextFlavorSuggestion,
      });
    }
  });
  return { ok: true };
}

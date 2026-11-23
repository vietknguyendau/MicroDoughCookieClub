import { and, asc, count, desc, eq, ilike, isNotNull, sql } from "drizzle-orm";
import type { DB } from "@/db/types";
import { events, flavorRatings, flavorVotes, flavors, surveyResponses, giveawayEntries } from "@/db/schema";

export type Metric = "score" | "avg" | "favorites" | "buyAgain" | "ratings";

export type FlavorStat = {
  flavorId: string;
  name: string;
  imageVersion: number;
  ratings: number;
  avgStars: number | null;
  favorites: number;
  buyAgainPct: number | null; // % answering "Absolutely!"
  score: number | null; // Bayesian-adjusted rating used for fair ranking
  confidence: "none" | "too_early" | "early" | "solid";
};

/**
 * Fair ranking ("Doughboard score"): every flavor starts with 5 imaginary
 * 3.5-star ratings. A single 5★ rating can't outrank a cookie with twenty 4.6★
 * ratings; with more real ratings the imaginary ones stop mattering.
 */
const PRIOR_WEIGHT = 5;
const PRIOR_MEAN = 3.5;

export function confidenceFor(n: number): FlavorStat["confidence"] {
  if (n === 0) return "none";
  if (n < 5) return "too_early";
  if (n < 15) return "early";
  return "solid";
}

export async function doughboard(db: DB, eventId: string | null, metric: Metric = "score"): Promise<FlavorStat[]> {
  const ratingWhere = eventId ? eq(flavorRatings.eventId, eventId) : undefined;
  const voteWhere = eventId ? eq(flavorVotes.eventId, eventId) : undefined;

  const [ratingRows, voteRows, flavorRows] = await Promise.all([
    db
      .select({
        flavorId: flavorRatings.flavorId,
        n: count(),
        sum: sql<number>`sum(${flavorRatings.stars})::float`,
        yes: sql<number>`count(*) filter (where ${flavorRatings.buyAgain} = 'absolutely')::int`,
      })
      .from(flavorRatings)
      .where(ratingWhere)
      .groupBy(flavorRatings.flavorId),
    db
      .select({ flavorId: flavorVotes.favoriteFlavorId, n: count() })
      .from(flavorVotes)
      .where(and(voteWhere, isNotNull(flavorVotes.favoriteFlavorId)))
      .groupBy(flavorVotes.favoriteFlavorId),
    db
      .select({ id: flavors.id, name: flavors.name, imageVersion: flavors.imageVersion, isActive: flavors.isActive })
      .from(flavors)
      .orderBy(asc(flavors.sortOrder)),
  ]);

  const ratingMap = new Map(ratingRows.map((r) => [r.flavorId, r]));
  const voteMap = new Map(voteRows.map((v) => [v.flavorId, Number(v.n)]));

  const stats: FlavorStat[] = flavorRows
    .filter((f) => f.isActive || ratingMap.has(f.id))
    .map((f) => {
      const r = ratingMap.get(f.id);
      const n = Number(r?.n ?? 0);
      const sum = Number(r?.sum ?? 0);
      return {
        flavorId: f.id,
        name: f.name,
        imageVersion: f.imageVersion,
        ratings: n,
        avgStars: n ? sum / n : null,
        favorites: voteMap.get(f.id) ?? 0,
        buyAgainPct: n ? (Number(r?.yes ?? 0) / n) * 100 : null,
        score: n ? (sum + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT) : null,
        confidence: confidenceFor(n),
      };
    });

  const key: Record<Metric, (s: FlavorStat) => number> = {
    score: (s) => s.score ?? -1,
    avg: (s) => s.avgStars ?? -1,
    favorites: (s) => s.favorites,
    buyAgain: (s) => s.buyAgainPct ?? -1,
    ratings: (s) => s.ratings,
  };
  return stats.sort((a, b) => key[metric](b) - key[metric](a) || b.ratings - a.ratings);
}

export async function overview(db: DB, eventId: string | null) {
  const evFilter = (col: typeof giveawayEntries.eventId | typeof surveyResponses.eventId | typeof flavorRatings.eventId) =>
    eventId ? eq(col, eventId) : undefined;
  const [[entries], [surveys], [avg], board] = await Promise.all([
    db.select({ n: count() }).from(giveawayEntries).where(evFilter(giveawayEntries.eventId)),
    db.select({ n: count() }).from(surveyResponses).where(evFilter(surveyResponses.eventId)),
    db
      .select({ v: sql<number | null>`avg(${flavorRatings.stars})::float` })
      .from(flavorRatings)
      .where(evFilter(flavorRatings.eventId)),
    doughboard(db, eventId, "favorites"),
  ]);
  const top = board.find((b) => b.favorites > 0) ?? null;
  return {
    entries: Number(entries.n),
    surveys: Number(surveys.n),
    avgRating: avg.v === null ? null : Number(avg.v),
    mostPopular: top,
  };
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listResponses(
  db: DB,
  opts: { eventId?: string | null; q?: string | null; limit?: number; offset?: number },
) {
  const where = and(
    opts.eventId ? eq(surveyResponses.eventId, opts.eventId) : undefined,
    opts.q
      ? sql`(${ilike(surveyResponses.comments, `%${escapeLike(opts.q)}%`)} or ${ilike(
          flavorVotes.nextFlavorSuggestion,
          `%${escapeLike(opts.q)}%`,
        )})`
      : undefined,
  );
  const rows = await db
    .select({
      id: surveyResponses.id,
      createdAt: surveyResponses.createdAt,
      comments: surveyResponses.comments,
      eventName: events.name,
      eventTz: events.timezone,
      favorite: flavors.name,
      suggestion: flavorVotes.nextFlavorSuggestion,
    })
    .from(surveyResponses)
    .innerJoin(events, eq(events.id, surveyResponses.eventId))
    .leftJoin(flavorVotes, eq(flavorVotes.responseId, surveyResponses.id))
    .leftJoin(flavors, eq(flavors.id, flavorVotes.favoriteFlavorId))
    .where(where)
    .orderBy(desc(surveyResponses.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  const ids = rows.map((r) => r.id);
  const ratings = ids.length
    ? await db
        .select({
          responseId: flavorRatings.responseId,
          flavor: flavors.name,
          stars: flavorRatings.stars,
          buyAgain: flavorRatings.buyAgain,
        })
        .from(flavorRatings)
        .innerJoin(flavors, eq(flavors.id, flavorRatings.flavorId))
        .where(sql`${flavorRatings.responseId} in ${ids}`)
    : [];
  return rows.map((r) => ({ ...r, ratings: ratings.filter((x) => x.responseId === r.id) }));
}

export async function recentComments(db: DB, limit = 5) {
  return db
    .select({
      comments: surveyResponses.comments,
      createdAt: surveyResponses.createdAt,
      eventName: events.name,
    })
    .from(surveyResponses)
    .innerJoin(events, eq(events.id, surveyResponses.eventId))
    .where(isNotNull(surveyResponses.comments))
    .orderBy(desc(surveyResponses.createdAt))
    .limit(limit);
}

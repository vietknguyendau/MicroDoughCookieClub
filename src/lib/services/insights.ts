import { asc, eq, isNotNull, sql } from "drizzle-orm";
import type { DB } from "@/db/types";
import { events, flavorRatings, flavorVotes, flavors } from "@/db/schema";

/**
 * Menu Planner: turns raw ratings into a plain-English recommendation per cookie.
 * All thresholds live here so they're easy to tune after a few pop-ups.
 */
export const RULES = {
  minRatings: 5, // below this → "needs more tastings"
  priorWeight: 5, // fair score: 5 imaginary ratings…
  priorMean: 3.5, // …of 3.5★ each
  star: { score: 4.3, buyAgain: 60 }, // bring every time
  keep: { score: 3.9 }, // keep in rotation
  rethink: { score: 3.3, buyAgain: 25 }, // below either → rethink
  polarizingStdDev: 1.2, // big disagreement between tasters
};

export type Verdict = "star" | "keep" | "later" | "rethink" | "needs_data";

export const VERDICTS: Record<Verdict, { label: string; emoji: string; advice: string }> = {
  star: { label: "Bring every time", emoji: "⭐", advice: "A crowd favorite. Make it a menu anchor and bake extra." },
  keep: { label: "Keep in rotation", emoji: "👍", advice: "Solidly liked. Keep it on most menus." },
  later: {
    label: "Save for later",
    emoji: "🗓️",
    advice: "Fine but not a standout. Rest it, then bring it back as a seasonal or special-edition drop.",
  },
  rethink: { label: "Rethink", emoji: "🔧", advice: "People aren't loving it. Tweak the recipe or retire it." },
  needs_data: { label: "Needs more tastings", emoji: "🔍", advice: "Too few ratings to judge. Feature it at the next pop-up." },
};

export type FlavorInsight = {
  flavorId: string;
  name: string;
  imageVersion: number;
  isActive: boolean;
  ratings: number;
  avgStars: number | null;
  score: number | null;
  stdDev: number | null;
  buyAgainPct: number | null;
  maybePct: number | null;
  favorites: number;
  favoriteShare: number | null; // % of tasters who picked it as THE favorite
  polarizing: boolean;
  verdict: Verdict;
  reasons: string[];
  byEvent: { eventId: string; eventName: string; startsAt: Date; ratings: number; avgStars: number }[];
  trend: "up" | "down" | "flat" | null;
};

export function classify(s: {
  ratings: number;
  score: number | null;
  buyAgainPct: number | null;
}): Verdict {
  if (s.ratings < RULES.minRatings || s.score === null) return "needs_data";
  const buy = s.buyAgainPct ?? 0;
  if (s.score >= RULES.star.score && buy >= RULES.star.buyAgain) return "star";
  if (s.score < RULES.rethink.score || buy < RULES.rethink.buyAgain) return "rethink";
  if (s.score >= RULES.keep.score) return "keep";
  return "later";
}

export async function menuPlan(db: DB, eventId: string | null) {
  const where = eventId ? eq(flavorRatings.eventId, eventId) : undefined;
  const [overall, perEvent, votes, triers, flavorRows, suggestions] = await Promise.all([
    db
      .select({
        flavorId: flavorRatings.flavorId,
        n: sql<number>`count(*)::int`,
        avg: sql<number>`avg(${flavorRatings.stars})::float`,
        sd: sql<number | null>`stddev_samp(${flavorRatings.stars})::float`,
        yes: sql<number>`count(*) filter (where ${flavorRatings.buyAgain} = 'absolutely')::int`,
        maybe: sql<number>`count(*) filter (where ${flavorRatings.buyAgain} = 'maybe')::int`,
      })
      .from(flavorRatings)
      .where(where)
      .groupBy(flavorRatings.flavorId),
    db
      .select({
        flavorId: flavorRatings.flavorId,
        eventId: events.id,
        eventName: events.name,
        startsAt: events.startsAt,
        n: sql<number>`count(*)::int`,
        avg: sql<number>`avg(${flavorRatings.stars})::float`,
      })
      .from(flavorRatings)
      .innerJoin(events, eq(events.id, flavorRatings.eventId))
      .groupBy(flavorRatings.flavorId, events.id, events.name, events.startsAt)
      .orderBy(asc(events.startsAt)),
    db
      .select({ flavorId: flavorVotes.favoriteFlavorId, n: sql<number>`count(*)::int` })
      .from(flavorVotes)
      .where(eventId ? sql`${flavorVotes.eventId} = ${eventId} and ${flavorVotes.favoriteFlavorId} is not null` : isNotNull(flavorVotes.favoriteFlavorId))
      .groupBy(flavorVotes.favoriteFlavorId),
    // tasters who tried the flavor AND cast a favorite vote (fair denominator for favorite share)
    db.execute<{ flavor_id: string; n: number }>(sql`
      select r.flavor_id, count(*)::int as n
      from flavor_ratings r join flavor_votes v on v.response_id = r.response_id
      where v.favorite_flavor_id is not null ${eventId ? sql`and r.event_id = ${eventId}` : sql``}
      group by r.flavor_id`),
    db
      .select({ id: flavors.id, name: flavors.name, imageVersion: flavors.imageVersion, isActive: flavors.isActive })
      .from(flavors)
      .orderBy(asc(flavors.sortOrder)),
    db
      .select({ text: flavorVotes.nextFlavorSuggestion })
      .from(flavorVotes)
      .where(
        eventId
          ? sql`${flavorVotes.eventId} = ${eventId} and ${flavorVotes.nextFlavorSuggestion} is not null`
          : isNotNull(flavorVotes.nextFlavorSuggestion),
      ),
  ]);

  const om = new Map(overall.map((o) => [o.flavorId, o]));
  const vm = new Map(votes.map((v) => [v.flavorId, Number(v.n)]));
  const tm = new Map(triers.rows.map((t) => [t.flavor_id, Number(t.n)]));

  const insights: FlavorInsight[] = flavorRows
    .filter((f) => f.isActive || om.has(f.id))
    .map((f) => {
      const o = om.get(f.id);
      const n = Number(o?.n ?? 0);
      const avg = n ? Number(o!.avg) : null;
      const score = n ? (avg! * n + RULES.priorWeight * RULES.priorMean) / (n + RULES.priorWeight) : null;
      const sd = o?.sd === null || o?.sd === undefined ? null : Number(o.sd);
      const buyAgainPct = n ? (Number(o!.yes) / n) * 100 : null;
      const maybePct = n ? (Number(o!.maybe) / n) * 100 : null;
      const favorites = vm.get(f.id) ?? 0;
      const voters = tm.get(f.id) ?? 0;
      const favoriteShare = voters ? (favorites / voters) * 100 : null;
      const polarizing = n >= RULES.minRatings && sd !== null && sd >= RULES.polarizingStdDev;
      const byEvent = eventId
        ? []
        : perEvent
            .filter((p) => p.flavorId === f.id)
            .map((p) => ({ eventId: p.eventId, eventName: p.eventName, startsAt: p.startsAt, ratings: Number(p.n), avgStars: Number(p.avg) }));
      const solid = byEvent.filter((b) => b.ratings >= 3);
      let trend: FlavorInsight["trend"] = null;
      if (solid.length >= 2) {
        const d = solid[solid.length - 1].avgStars - solid[solid.length - 2].avgStars;
        trend = d >= 0.3 ? "up" : d <= -0.3 ? "down" : "flat";
      }
      const verdict = classify({ ratings: n, score, buyAgainPct });

      const reasons: string[] = [];
      if (n < RULES.minRatings) reasons.push(`Only ${n} rating${n === 1 ? "" : "s"} so far (need ${RULES.minRatings}+).`);
      else {
        reasons.push(`${avg!.toFixed(1)}★ average from ${n} ratings (fair score ${score!.toFixed(2)}).`);
        reasons.push(`${Math.round(buyAgainPct!)}% would "Absolutely!" buy again, ${Math.round(maybePct!)}% maybe.`);
        if (favoriteShare !== null && voters >= 3)
          reasons.push(`Picked as THE favorite by ${Math.round(favoriteShare)}% of people who tried it.`);
        if (polarizing) reasons.push("Divisive: some love it, some don't. A great special-edition drop for fans.");
        if (trend === "up") reasons.push("Trending up at the latest pop-up.");
        if (trend === "down") reasons.push("Dipped at the latest pop-up. Check the batch or the recipe.");
      }
      return {
        flavorId: f.id, name: f.name, imageVersion: f.imageVersion, isActive: f.isActive,
        ratings: n, avgStars: avg, score, stdDev: sd, buyAgainPct, maybePct, favorites, favoriteShare,
        polarizing, verdict, reasons, byEvent, trend,
      };
    });

  const order: Verdict[] = ["star", "keep", "later", "rethink", "needs_data"];
  insights.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || (b.score ?? 0) - (a.score ?? 0));

  return { insights, suggestions: groupSuggestions(suggestions.map((s) => s.text ?? "")) };
}

function tidy(s: string) {
  const t = s.replace(/[!?.,~]+$/g, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Groups free-text "bake next" ideas: "Matcha!!", "matcha " and "MATCHA" count as one. */
export function groupSuggestions(texts: string[], limit = 15) {
  const groups = new Map<string, { label: string; count: number }>();
  for (const raw of texts) {
    const label = raw.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\b(cookie|cookies|flavor|flavour|please|a|an|the)\b/g, "").replace(/\s+/g, " ").trim();
    if (!key) continue;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { label: tidy(label), count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

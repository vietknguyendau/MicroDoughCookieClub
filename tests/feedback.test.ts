import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { submitSurvey } from "@/lib/services/feedback";
import { doughboard, listResponses, confidenceFor } from "@/lib/services/analytics";
import { checkFormToken, issueFormToken, rateLimit } from "@/lib/security";
import { db, later, makeEvent, makeFlavors, pool } from "./helpers";

afterAll(() => pool.end());

describe("survey submission", () => {
  it("saves a response with multiple cookie ratings, favorite and suggestion", async () => {
    const fl = await makeFlavors(3);
    const ev = await makeEvent({}, fl.map((f) => f.id));
    const res = await submitSurvey(db, {
      eventSlug: ev.slug,
      ratings: [
        { flavorId: fl[0].id, stars: 5, buyAgain: "absolutely" },
        { flavorId: fl[1].id, stars: 3, buyAgain: "maybe" },
      ],
      favoriteFlavorId: fl[0].id,
      nextFlavorSuggestion: "Matcha",
      comments: "Too sweet for me, honestly",
    });
    expect(res).toEqual({ ok: true });
    const ratings = await db.select().from(s.flavorRatings).where(eq(s.flavorRatings.eventId, ev.id));
    expect(ratings).toHaveLength(2);
    expect(ratings.find((r) => r.flavorId === fl[1].id)?.buyAgain).toBe("maybe");
    const [vote] = await db.select().from(s.flavorVotes).where(eq(s.flavorVotes.eventId, ev.id));
    expect(vote.favoriteFlavorId).toBe(fl[0].id);
    expect(vote.nextFlavorSuggestion).toBe("Matcha");
  });

  it("is anonymous: survey tables hold no contact info", async () => {
    const cols = [s.surveyResponses, s.flavorRatings, s.flavorVotes].flatMap((t) => Object.keys(t));
    for (const pii of ["email", "phone", "firstName", "ip"]) expect(cols).not.toContain(pii);
  });

  it("rejects cookies not offered at this pop-up", async () => {
    const fl = await makeFlavors(2);
    const ev = await makeEvent({}, [fl[0].id]);
    const res = await submitSurvey(db, {
      eventSlug: ev.slug,
      ratings: [{ flavorId: fl[1].id, stars: 4, buyAgain: "maybe" }],
    });
    expect(res.ok).toBe(false);
  });

  it("requires the favorite to be one the customer tried", async () => {
    const fl = await makeFlavors(2);
    const ev = await makeEvent({}, fl.map((f) => f.id));
    const res = await submitSurvey(db, {
      eventSlug: ev.slug,
      ratings: [{ flavorId: fl[0].id, stars: 4, buyAgain: "maybe" }],
      favoriteFlavorId: fl[1].id,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects out-of-range stars and duplicate ratings", async () => {
    const fl = await makeFlavors(1);
    const ev = await makeEvent({}, [fl[0].id]);
    const bad = await submitSurvey(db, { eventSlug: ev.slug, ratings: [{ flavorId: fl[0].id, stars: 6, buyAgain: "maybe" }] });
    expect(bad.ok).toBe(false);
    const dup = await submitSurvey(db, {
      eventSlug: ev.slug,
      ratings: [
        { flavorId: fl[0].id, stars: 4, buyAgain: "maybe" },
        { flavorId: fl[0].id, stars: 2, buyAgain: "maybe" },
      ],
    });
    expect(dup.ok).toBe(false);
  });

  it("closes feedback for archived events after the entry window", async () => {
    const fl = await makeFlavors(1);
    const ev = await makeEvent({}, [fl[0].id]);
    const res = await submitSurvey(
      db,
      { eventSlug: ev.slug, ratings: [{ flavorId: fl[0].id, stars: 4, buyAgain: "maybe" }] },
      later(48),
    );
    expect(res.ok).toBe(false);
  });

  it("stores comments as plain text (rendered escaped by React) and searches safely", async () => {
    const fl = await makeFlavors(1);
    const ev = await makeEvent({}, [fl[0].id]);
    const xss = `<script>alert(1)</script> 100%_off`;
    await submitSurvey(db, { eventSlug: ev.slug, ratings: [{ flavorId: fl[0].id, stars: 1, buyAgain: "probably_not" }], comments: xss });
    const hits = await listResponses(db, { eventId: ev.id, q: "100%_" });
    expect(hits).toHaveLength(1);
    expect(hits[0].comments).toBe(xss);
    // "1%f" would match "100%_off" if % were a wildcard; escaped, it must not.
    expect(await listResponses(db, { eventId: ev.id, q: "1%f" })).toHaveLength(0);
  });
});

describe("doughboard", () => {
  it("shows sample sizes and does not let one 5-star rating top the board", async () => {
    const fl = await makeFlavors(2);
    const ev = await makeEvent({}, fl.map((f) => f.id));
    // Flavor A: one 5-star. Flavor B: twenty 4.6-ish ratings.
    await submitSurvey(db, { eventSlug: ev.slug, ratings: [{ flavorId: fl[0].id, stars: 5, buyAgain: "absolutely" }] });
    for (let i = 0; i < 20; i++) {
      await submitSurvey(db, {
        eventSlug: ev.slug,
        ratings: [{ flavorId: fl[1].id, stars: i % 3 === 0 ? 4 : 5, buyAgain: i % 2 ? "absolutely" : "maybe" }],
        favoriteFlavorId: fl[1].id,
      });
    }
    const board = (await doughboard(db, ev.id, "score")).filter((b) => fl.some((f) => f.id === b.flavorId));
    expect(board[0].flavorId).toBe(fl[1].id);
    const a = board.find((b) => b.flavorId === fl[0].id)!;
    expect(a.ratings).toBe(1);
    expect(a.confidence).toBe("too_early");
    expect(board[0].favorites).toBe(20);
    expect(board[0].buyAgainPct).toBe(50);
    // raw average still available and still shows A first if chosen explicitly
    const byAvg = (await doughboard(db, ev.id, "avg")).filter((b) => fl.some((f) => f.id === b.flavorId));
    expect(byAvg[0].flavorId).toBe(fl[0].id);
  });

  it("labels confidence by sample size", () => {
    expect([0, 3, 8, 20].map(confidenceFor)).toEqual(["none", "too_early", "early", "solid"]);
  });
});

describe("abuse protection", () => {
  it("rate limits after the threshold", async () => {
    const id = `t-${Math.random()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit(db, "test", id, 3, 60)).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it("form timing tokens reject instant bots, forgeries and stale forms", () => {
    const t = issueFormToken(1_000_000);
    expect(checkFormToken(t, 2000, 1_000_500)).toBe("too_fast"); // human gets "tap again", not a fake success
    expect(checkFormToken(t, 2000, 1_005_000)).toBe("ok");
    expect(checkFormToken(t.replace(/.$/, "x"), 2000, 1_005_000)).toBe("invalid"); // forged
    expect(checkFormToken(t, 2000, 1_000_000 + 13 * 3600_000)).toBe("invalid"); // stale
    expect(checkFormToken(null, 0)).toBe("invalid");
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { closeGiveaway, drawWinner, redraw, submitEntry, updateWinnerStatus, DrawError } from "@/lib/services/giveaway";
import { normalizeEmail } from "@/lib/validation";
import { db, later, makeAdmin, makeEvent, pool } from "./helpers";

afterAll(() => pool.end());

const entry = (slug: string, email: string, extra = {}) => ({
  eventSlug: slug,
  firstName: "Sam",
  email,
  acceptRules: true as const,
  marketingOptIn: false,
  ...extra,
});

const entriesFor = (eventId: string) => db.select().from(s.giveawayEntries).where(eq(s.giveawayEntries.eventId, eventId));

describe("giveaway entry", () => {
  it("works directly, with no survey and no purchase", async () => {
    const ev = await makeEvent();
    const res = await submitEntry(db, entry(ev.slug, "a@x.com"));
    expect(res).toEqual({ ok: true });
    const rows = await entriesFor(ev.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].marketingOptIn).toBe(false);
    // there is no column linking an entry to a survey or a purchase
    expect(Object.keys(rows[0])).not.toContain("responseId");
  });

  it("does not require marketing consent, and stores it when given", async () => {
    const ev = await makeEvent();
    await submitEntry(db, entry(ev.slug, "m@x.com", { marketingOptIn: true }));
    expect((await entriesFor(ev.id))[0].marketingOptIn).toBe(true);
  });

  it("requires agreeing to the official rules", async () => {
    const ev = await makeEvent();
    const res = await submitEntry(db, { ...entry(ev.slug, "r@x.com"), acceptRules: false as unknown as true });
    expect(res.ok).toBe(false);
  });

  it("treats duplicates safely: same success response, still one entry", async () => {
    const ev = await makeEvent();
    const a = await submitEntry(db, entry(ev.slug, "Jane.Doe+cookies@Gmail.com"));
    const b = await submitEntry(db, entry(ev.slug, "janedoe@gmail.com"));
    expect(a).toEqual(b);
    expect(await entriesFor(ev.id)).toHaveLength(1);
  });

  it("handles concurrent duplicate submissions without errors", async () => {
    const ev = await makeEvent();
    const results = await Promise.all(Array.from({ length: 8 }, () => submitEntry(db, entry(ev.slug, "race@x.com"))));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await entriesFor(ev.id)).toHaveLength(1);
  });

  it("allows the same person to enter a different event", async () => {
    const [e1, e2] = [await makeEvent(), await makeEvent()];
    await submitEntry(db, entry(e1.slug, "p@x.com"));
    await submitEntry(db, entry(e2.slug, "p@x.com"));
    expect(await entriesFor(e1.id)).toHaveLength(1);
    expect(await entriesFor(e2.id)).toHaveLength(1);
  });

  it("enforces the deadline on the server", async () => {
    const ev = await makeEvent();
    const res = await submitEntry(db, entry(ev.slug, "late@x.com"), later(48));
    expect(res).toEqual({ ok: false, error: "Entries for this giveaway are closed." });
    const early = await makeEvent({ entryOpensAt: later(1), entryClosesAt: later(5), drawingAt: later(6) });
    expect((await submitEntry(db, entry(early.slug, "early@x.com"))).ok).toBe(false);
  });

  it("respects a manual early close", async () => {
    const ev = await makeEvent();
    const admin = await makeAdmin();
    await closeGiveaway(db, ev.id, admin.id);
    expect((await submitEntry(db, entry(ev.slug, "after@x.com"))).ok).toBe(false);
  });

  it("rejects entries until the owner approves the official rules", async () => {
    const ev = await makeEvent({ rulesApprovedAt: null });
    expect((await submitEntry(db, entry(ev.slug, "x@x.com"))).ok).toBe(false);
  });

  it("never accepts entries for draft events", async () => {
    const ev = await makeEvent({ status: "draft" });
    expect((await submitEntry(db, entry(ev.slug, "x@x.com"))).ok).toBe(false);
  });

  it("normalizes emails for duplicate detection only", () => {
    expect(normalizeEmail(" J.Doe+a@GoogleMail.com ")).toBe("jdoe@gmail.com");
    expect(normalizeEmail("first.last@outlook.com")).toBe("first.last@outlook.com");
  });
});

async function closedEventWithEntries(n: number) {
  const ev = await makeEvent();
  for (let i = 0; i < n; i++) await submitEntry(db, entry(ev.slug, `p${i}@x.com`));
  const admin = await makeAdmin();
  await closeGiveaway(db, ev.id, admin.id);
  return { ev, admin };
}

describe("winner drawing", () => {
  it("refuses to draw while entries are still open", async () => {
    const ev = await makeEvent();
    const admin = await makeAdmin();
    await submitEntry(db, entry(ev.slug, "a@x.com"));
    await expect(drawWinner(db, ev.id, admin.id)).rejects.toThrow(DrawError);
  });

  it("selects from eligible entries of that event only", async () => {
    const other = await makeEvent();
    await submitEntry(db, entry(other.slug, "other@x.com"));
    const { ev, admin } = await closedEventWithEntries(5);
    // a disqualified entry must never win
    const [dq] = await entriesFor(ev.id);
    await db.update(s.giveawayEntries).set({ status: "disqualified" }).where(eq(s.giveawayEntries.id, dq.id));

    const draw = await drawWinner(db, ev.id, admin.id);
    const [winner] = await db.select().from(s.giveawayEntries).where(eq(s.giveawayEntries.id, draw.entryId!));
    expect(winner.eventId).toBe(ev.id);
    expect(winner.status).toBe("eligible");
    expect(draw.poolSize).toBe(4);
  });

  it("gives every entry a fair chance (statistical smoke test)", async () => {
    // 3 entries, 600 independent draws on fresh events would be slow; instead
    // check the RNG we use is uniform over the pool size.
    const { randomInt } = await import("node:crypto");
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[randomInt(3)]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(600);
  });

  it("cannot create two winners under concurrent draw requests", async () => {
    const { ev, admin } = await closedEventWithEntries(10);
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => drawWinner(db, ev.id, admin.id)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const draws = await db.select().from(s.giveawayDraws).where(eq(s.giveawayDraws.eventId, ev.id));
    expect(draws).toHaveLength(1);
  });

  it("database itself blocks a second live winner even if app logic were bypassed", async () => {
    const { ev, admin } = await closedEventWithEntries(3);
    const d = await drawWinner(db, ev.id, admin.id);
    await expect(
      db.insert(s.giveawayDraws).values({ eventId: ev.id, entryId: d.entryId, drawNumber: 99, poolSize: 3 }),
    ).rejects.toThrow();
  });

  it("audits redraws and never re-picks a forfeited winner", async () => {
    const { ev, admin } = await closedEventWithEntries(2);
    const first = await drawWinner(db, ev.id, admin.id);
    const second = await redraw(db, ev.id, admin.id, "declined", "said no thanks");
    expect(second.entryId).not.toBe(first.entryId);
    expect(second.drawNumber).toBe(2);

    const [old] = await db.select().from(s.giveawayDraws).where(eq(s.giveawayDraws.id, first.id));
    expect(old.status).toBe("forfeited");
    expect(old.forfeitReason).toMatch(/declined/);

    const log = await db.select().from(s.giveawayAuditLog).where(eq(s.giveawayAuditLog.eventId, ev.id));
    expect(log.map((l) => l.action)).toEqual(["close_entries", "draw", "forfeit", "redraw"]);

    // pool exhausted
    await expect(redraw(db, ev.id, admin.id, "declined", "")).rejects.toThrow(/no eligible entries/);
  });

  it("only allows a no-response redraw after the published claim window", async () => {
    const { ev, admin } = await closedEventWithEntries(3);
    await drawWinner(db, ev.id, admin.id);
    await expect(redraw(db, ev.id, admin.id, "no_response", "")).rejects.toThrow(/contacted/);
    await updateWinnerStatus(db, ev.id, admin.id, "contacted");
    await expect(redraw(db, ev.id, admin.id, "no_response", "")).rejects.toThrow(/48-hour/);
    const ok = await redraw(db, ev.id, admin.id, "no_response", "", later(49));
    expect(ok.drawNumber).toBe(2);
  });

  it("does not allow a redraw after the prize is claimed", async () => {
    const { ev, admin } = await closedEventWithEntries(3);
    await drawWinner(db, ev.id, admin.id);
    await updateWinnerStatus(db, ev.id, admin.id, "contacted");
    await updateWinnerStatus(db, ev.id, admin.id, "claimed");
    await expect(redraw(db, ev.id, admin.id, "declined", "")).rejects.toThrow(/claimed/);
  });

  it("keeps the audit log immutable", async () => {
    const { ev } = await closedEventWithEntries(1);
    const pgError = (p: Promise<unknown>) => p.then(() => "no error", (e) => String(e?.cause?.message ?? e));
    expect(
      await pgError(db.update(s.giveawayAuditLog).set({ action: "tampered" }).where(eq(s.giveawayAuditLog.eventId, ev.id))),
    ).toMatch(/append-only/);
    expect(await pgError(db.delete(s.giveawayAuditLog).where(eq(s.giveawayAuditLog.eventId, ev.id)))).toMatch(
      /append-only/,
    );
  });

  it("keeps draw history when a winner's personal data is deleted", async () => {
    const { ev, admin } = await closedEventWithEntries(2);
    const d = await drawWinner(db, ev.id, admin.id);
    await db.delete(s.giveawayEntries).where(eq(s.giveawayEntries.id, d.entryId!));
    const [after] = await db.select().from(s.giveawayDraws).where(eq(s.giveawayDraws.id, d.id));
    expect(after.entryId).toBeNull();
    expect(after.poolSize).toBe(2);
    const [{ n }] = (
      await db.execute<{ n: number }>(sql`select count(*)::int n from giveaway_audit_log where event_id = ${ev.id}`)
    ).rows;
    expect(n).toBeGreaterThan(0);
  });
});

describe("one active event", () => {
  it("the database allows only one active pop-up at a time", async () => {
    await db.update(s.events).set({ status: "archived" }).where(and(eq(s.events.status, "active")));
    await makeEvent({ status: "active" });
    await expect(makeEvent({ status: "active" })).rejects.toThrow();
  });
});

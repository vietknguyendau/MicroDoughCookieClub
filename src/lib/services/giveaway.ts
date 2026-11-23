import { randomInt } from "node:crypto";
import { and, asc, desc, eq, inArray, notInArray, sql, count } from "drizzle-orm";
import type { DB, Tx } from "@/db/types";
import { events, giveawayAuditLog, giveawayDraws, giveawayEntries } from "@/db/schema";
import { entrySchema, normalizeEmail, type EntryInput } from "@/lib/validation";
import { effectiveCloseAt, getPublicEvent, giveawayPhase } from "./events";

/* ─────────────────────────── Entries ─────────────────────────── */

export type EntryResult = { ok: true } | { ok: false; error: string; field?: string };

/**
 * Creates an entry. Duplicates return the SAME success response as a new entry,
 * so nobody can probe whether an email has already entered.
 * No purchase, survey, follow, or marketing consent is required or considered.
 */
export async function submitEntry(db: DB, raw: EntryInput, now = new Date()): Promise<EntryResult> {
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Please check the form", field: String(issue?.path[0] ?? "") };
  }
  const input = parsed.data;
  const ev = await getPublicEvent(db, input.eventSlug);
  if (!ev) return { ok: false, error: "We couldn't find that giveaway." };

  const phase = giveawayPhase(ev, now);
  if (phase === "not_open") return { ok: false, error: "Entries for this giveaway haven't opened yet." };
  if (phase !== "open") return { ok: false, error: "Entries for this giveaway are closed." };

  await db
    .insert(giveawayEntries)
    .values({
      eventId: ev.id,
      firstName: input.firstName,
      email: input.email,
      emailNormalized: normalizeEmail(input.email),
      phone: input.phone,
      rulesAcceptedAt: now,
      marketingOptIn: input.marketingOptIn,
    })
    .onConflictDoNothing({ target: [giveawayEntries.eventId, giveawayEntries.emailNormalized] });

  return { ok: true };
}

/* ─────────────────────────── Drawing ─────────────────────────── */

export class DrawError extends Error {}

export const REDRAW_REASONS = {
  no_response: "Winner did not respond within the claim window",
  ineligible: "Winner found ineligible under the official rules",
  declined: "Winner declined the prize",
  unable_to_claim: "Winner could not claim the prize by the claim deadline",
} as const;
export type RedrawReason = keyof typeof REDRAW_REASONS;

async function lockEvent(tx: Tx, eventId: string) {
  // Row lock serializes every draw/redraw for this event: two simultaneous
  // taps on "Draw winner" queue up instead of racing.
  const rows = await tx.execute<{ id: string }>(sql`select id from events where id = ${eventId} for update`);
  if (rows.rows.length === 0) throw new DrawError("Event not found");
  const [ev] = await tx.select().from(events).where(eq(events.id, eventId));
  return ev;
}

async function liveDraw(tx: Tx, eventId: string) {
  const [d] = await tx
    .select()
    .from(giveawayDraws)
    .where(
      and(eq(giveawayDraws.eventId, eventId), inArray(giveawayDraws.status, ["selected", "contacted", "claimed"])),
    );
  return d ?? null;
}

async function pickAndRecord(tx: Tx, eventId: string, adminId: string, action: "draw" | "redraw") {
  const previous = await tx
    .select({ entryId: giveawayDraws.entryId, n: giveawayDraws.drawNumber })
    .from(giveawayDraws)
    .where(eq(giveawayDraws.eventId, eventId))
    .orderBy(desc(giveawayDraws.drawNumber));
  const excluded = previous.map((p) => p.entryId).filter((x): x is string => !!x);

  const pool = await tx
    .select({ id: giveawayEntries.id })
    .from(giveawayEntries)
    .where(
      and(
        eq(giveawayEntries.eventId, eventId),
        eq(giveawayEntries.status, "eligible"),
        excluded.length ? notInArray(giveawayEntries.id, excluded) : undefined,
      ),
    )
    .orderBy(asc(giveawayEntries.createdAt), asc(giveawayEntries.id));

  if (pool.length === 0) throw new DrawError("There are no eligible entries left to draw from.");

  // Cryptographically secure, uniform: every eligible entry has identical odds.
  const index = randomInt(pool.length);
  const winner = pool[index];
  const drawNumber = (previous[0]?.n ?? 0) + 1;

  const [draw] = await tx
    .insert(giveawayDraws)
    .values({ eventId, entryId: winner.id, drawNumber, poolSize: pool.length, drawnBy: adminId })
    .returning();

  await tx.insert(giveawayAuditLog).values({
    eventId,
    drawId: draw.id,
    action,
    actorAdminId: adminId,
    details: { drawNumber, poolSize: pool.length, method: "node:crypto.randomInt", excludedPriorWinners: excluded.length },
  });
  return draw;
}

export async function drawWinner(db: DB, eventId: string, adminId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    if (!ev.giveawayEnabled) throw new DrawError("This event has no giveaway.");
    if (!ev.rulesApprovedAt) throw new DrawError("Official rules were never approved for this giveaway.");
    if (now < effectiveCloseAt(ev)) throw new DrawError("Close the giveaway before drawing a winner.");
    if (await liveDraw(tx, eventId)) throw new DrawError("A winner has already been drawn for this giveaway.");
    return pickAndRecord(tx, eventId, adminId, "draw");
  });
}

export async function redraw(
  db: DB,
  eventId: string,
  adminId: string,
  reason: RedrawReason,
  note: string,
  now = new Date(),
) {
  if (!(reason in REDRAW_REASONS)) throw new DrawError("Choose a reason allowed by the official rules.");
  return db.transaction(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    const current = await liveDraw(tx, eventId);
    if (!current) throw new DrawError("There's no current winner to replace.");
    if (current.status === "claimed") throw new DrawError("The prize was already claimed — no redraw allowed.");
    if (reason === "no_response") {
      if (!current.contactedAt) throw new DrawError("Mark the winner as contacted first, then wait out the claim window.");
      const deadline = current.contactedAt.getTime() + ev.claimWindowHours * 3600_000;
      if (now.getTime() < deadline) {
        throw new DrawError(`The ${ev.claimWindowHours}-hour response window hasn't passed yet.`);
      }
    }
    await tx
      .update(giveawayDraws)
      .set({ status: "forfeited", forfeitedAt: now, forfeitReason: `${REDRAW_REASONS[reason]}${note ? ` — ${note}` : ""}` })
      .where(eq(giveawayDraws.id, current.id));
    await tx.insert(giveawayAuditLog).values({
      eventId,
      drawId: current.id,
      action: "forfeit",
      actorAdminId: adminId,
      details: { reason, note: note.slice(0, 500) },
    });
    return pickAndRecord(tx, eventId, adminId, "redraw");
  });
}

export async function updateWinnerStatus(
  db: DB,
  eventId: string,
  adminId: string,
  status: "contacted" | "claimed",
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const current = await liveDraw(tx, eventId);
    if (!current) throw new DrawError("No current winner.");
    if (status === "claimed" && current.status === "claimed") return current;
    if (status === "contacted" && current.status !== "selected") return current;
    const [updated] = await tx
      .update(giveawayDraws)
      .set(status === "contacted" ? { status, contactedAt: now } : { status, claimedAt: now })
      .where(eq(giveawayDraws.id, current.id))
      .returning();
    await tx.insert(giveawayAuditLog).values({ eventId, drawId: current.id, action: status, actorAdminId: adminId });
    return updated;
  });
}

export async function closeGiveaway(db: DB, eventId: string, adminId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const ev = await lockEvent(tx, eventId);
    if (ev.giveawayClosedAt || now >= ev.entryClosesAt) return;
    await tx.update(events).set({ giveawayClosedAt: now, updatedAt: now }).where(eq(events.id, eventId));
    await tx.insert(giveawayAuditLog).values({
      eventId,
      action: "close_entries",
      actorAdminId: adminId,
      details: { scheduledClose: ev.entryClosesAt.toISOString() },
    });
  });
}

export async function eligibleCount(db: DB, eventId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(giveawayEntries)
    .where(and(eq(giveawayEntries.eventId, eventId), eq(giveawayEntries.status, "eligible")));
  return Number(r?.n ?? 0);
}

import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { DBorTx } from "@/db/types";
import { eventFlavors, events, flavors } from "@/db/schema";

export type EventRow = typeof events.$inferSelect;

export async function getEventBySlug(db: DBorTx, slug: string) {
  const [row] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return row ?? null;
}

export async function getActiveEvent(db: DBorTx) {
  const [row] = await db.select().from(events).where(eq(events.status, "active")).limit(1);
  return row ?? null;
}

/** Public visitors can see active and archived events, never drafts. */
export async function getPublicEvent(db: DBorTx, slug: string) {
  const ev = await getEventBySlug(db, slug);
  return ev && ev.status !== "draft" ? ev : null;
}

export async function getEventFlavors(db: DBorTx, eventId: string) {
  return db
    .select({
      id: flavors.id,
      name: flavors.name,
      slug: flavors.slug,
      description: flavors.description,
      imageVersion: flavors.imageVersion,
    })
    .from(eventFlavors)
    .innerJoin(flavors, eq(flavors.id, eventFlavors.flavorId))
    .where(eq(eventFlavors.eventId, eventId))
    .orderBy(asc(eventFlavors.sortOrder), asc(flavors.sortOrder));
}

export type GiveawayPhase = "disabled" | "unpublished" | "not_open" | "open" | "closed";

/** Single source of truth for whether entries are accepted right now. */
export function giveawayPhase(ev: EventRow, now = new Date()): GiveawayPhase {
  if (!ev.giveawayEnabled) return "disabled";
  if (!ev.rulesApprovedAt || ev.status === "draft") return "unpublished";
  if (now < ev.entryOpensAt) return "not_open";
  const closesAt = effectiveCloseAt(ev);
  if (now >= closesAt) return "closed";
  return "open";
}

export function effectiveCloseAt(ev: EventRow) {
  return ev.giveawayClosedAt && ev.giveawayClosedAt < ev.entryClosesAt ? ev.giveawayClosedAt : ev.entryClosesAt;
}

/** Feedback is accepted while the event is active, or until its entry window closes. */
export function feedbackOpen(ev: EventRow, now = new Date()) {
  if (ev.status === "draft") return false;
  if (ev.status === "active") return true;
  return now < ev.entryClosesAt;
}

/** For the friendly fallback page: archived events whose giveaway is still open remotely. */
export async function listOpenGiveaways(db: DBorTx, now = new Date()) {
  const rows = await db
    .select()
    .from(events)
    .where(and(ne(events.status, "draft"), eq(events.giveawayEnabled, true)))
    .orderBy(desc(events.startsAt))
    .limit(10);
  return rows.filter((e) => giveawayPhase(e, now) === "open");
}

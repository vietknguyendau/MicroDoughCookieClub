"use server";

import { and, asc, count, eq, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  adminUsers,
  eventFlavors,
  events,
  flavorImages,
  flavorRatings,
  flavors,
  giveawayAuditLog,
  giveawayEntries,
  rateLimits,
  settings,
  surveyResponses,
  adminSessions,
} from "@/db/schema";
import { hashPassword, logout, requireAdmin, verifyPassword } from "@/lib/auth";
import {
  closeGiveaway,
  drawWinner,
  DrawError,
  redraw,
  REDRAW_REASONS,
  updateWinnerStatus,
  type RedrawReason,
} from "@/lib/services/giveaway";
import { normalizeEmail, slugify } from "@/lib/validation";
import { zonedInputToUtc, DEFAULT_TZ } from "@/lib/time";

/**
 * Admin actions finish by "going" somewhere with a notice/error. Instead of
 * next/navigation's redirect (whose client-side handling proved flaky for
 * back-to-back actions), we throw a Go signal, the act() wrapper turns it into
 * { to }, and <ActionForm> does a plain full-page navigation. Boring = reliable.
 */
class Go {
  constructor(public url: string) {}
}
function go(path: string, params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  throw new Go(qs ? `${path}?${qs}` : path);
}
export type ActionResult = { to?: string } | null;
function act(fn: (form: FormData) => Promise<unknown>) {
  return async (_prev: ActionResult, form: FormData): Promise<ActionResult> => {
    try {
      await fn(form);
      return null;
    } catch (e) {
      if (e instanceof Go) return { to: e.url };
      throw e;
    }
  };
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/* ─────────────────────────── Events ─────────────────────────── */

const eventForm = z
  .object({
    name: z.string().min(2, "Give the pop-up a name").max(100),
    locationName: z.string().max(120),
    locationAddress: z.string().max(200),
    startsAt: z.string().min(1, "Start time is required"),
    endsAt: z.string().min(1, "End time is required"),
    giveawayEnabled: z.boolean(),
    entryOpensAt: z.string().min(1, "Entry start is required"),
    entryClosesAt: z.string().min(1, "Entry deadline is required"),
    drawingAt: z.string().min(1, "Drawing date is required"),
    claimWindowHours: z.coerce.number().int().min(24).max(336),
    prizeDescription: z.string().min(3).max(200),
    prizeValue: z.coerce.number().min(0).max(1000),
    eligibility: z.string().min(10).max(500),
    fulfillment: z.string().min(5).max(500),
    additionalRules: z.string().max(2000),
  })
  .transform((v, ctx) => {
    try {
      const t = (s: string) => zonedInputToUtc(s, DEFAULT_TZ);
      const out = {
        ...v,
        startsAt: t(v.startsAt),
        endsAt: t(v.endsAt),
        entryOpensAt: t(v.entryOpensAt),
        entryClosesAt: t(v.entryClosesAt),
        drawingAt: t(v.drawingAt),
        prizeValueCents: Math.round(v.prizeValue * 100),
      };
      if (out.endsAt <= out.startsAt) ctx.addIssue({ code: "custom", message: "The pop-up must end after it starts." });
      if (out.entryClosesAt <= out.entryOpensAt)
        ctx.addIssue({ code: "custom", message: "Entry deadline must be after entries open." });
      if (out.drawingAt < out.entryClosesAt)
        ctx.addIssue({ code: "custom", message: "The drawing must be on or after the entry deadline." });
      return out;
    } catch {
      ctx.addIssue({ code: "custom", message: "One of the dates isn't valid." });
      return z.NEVER;
    }
  });

const RULE_FIELDS = [
  "entryOpensAt",
  "entryClosesAt",
  "drawingAt",
  "claimWindowHours",
  "prizeDescription",
  "prizeValueCents",
  "eligibility",
  "fulfillment",
  "additionalRules",
] as const;

export const saveEventAction = act(async (form: FormData) => {
  const admin = await requireAdmin();
  const id = str(form, "id") || null;
  const parsed = eventForm.safeParse({
    ...Object.fromEntries(
      [
        "name", "locationName", "locationAddress", "startsAt", "endsAt", "entryOpensAt", "entryClosesAt",
        "drawingAt", "claimWindowHours", "prizeDescription", "prizeValue", "eligibility", "fulfillment", "additionalRules",
      ].map((k) => [k, str(form, k)]),
    ),
    giveawayEnabled: form.get("giveawayEnabled") === "on",
  });
  const back = id ? `/admin/events/${id}` : "/admin/events/new";
  if (!parsed.success) go(back, { error: parsed.error!.issues[0].message });
  const { prizeValue: _omit, ...v } = parsed.data!;
  void _omit;
  const flavorIds = form.getAll("flavorIds").map(String);

  let eventId = id;
  if (!id) {
    const base = slugify(`${v.name}-${v.startsAt.toISOString().slice(0, 10)}`) || "popup";
    let slug = base;
    for (let i = 2; (await db.select({ id: events.id }).from(events).where(eq(events.slug, slug))).length; i++) slug = `${base}-${i}`;
    const [row] = await db.insert(events).values({ ...v, slug, timezone: DEFAULT_TZ }).returning({ id: events.id });
    eventId = row.id;
  } else {
    const [current] = await db.select().from(events).where(eq(events.id, id));
    if (!current) go("/admin/events", { error: "Event not found" });
    const rulesChanged = RULE_FIELDS.some((k) => String(current[k]) !== String(v[k]));
    const [{ n }] = await db.select({ n: count() }).from(giveawayEntries).where(eq(giveawayEntries.eventId, id));
    if (rulesChanged && Number(n) > 0 && current.rulesApprovedAt) {
      go(back, { error: "People have already entered under the published rules, so giveaway terms are locked." });
    }
    await db
      .update(events)
      .set({ ...v, updatedAt: new Date(), ...(rulesChanged ? { rulesApprovedAt: null, rulesApprovedBy: null } : {}) })
      .where(eq(events.id, id));
  }

  await db.transaction(async (tx) => {
    await tx.delete(eventFlavors).where(eq(eventFlavors.eventId, eventId!));
    if (flavorIds.length) {
      const ordered = await tx.select({ id: flavors.id }).from(flavors).orderBy(asc(flavors.sortOrder));
      const chosen = ordered.filter((f) => flavorIds.includes(f.id));
      if (chosen.length)
        await tx.insert(eventFlavors).values(chosen.map((f, i) => ({ eventId: eventId!, flavorId: f.id, sortOrder: i })));
    }
  });
  void admin;
  go(`/admin/events/${eventId}`, { notice: id ? "Saved!" : "Pop-up created! Review the rules below, then activate it." });
});

export const setEventStatusAction = act(async (form: FormData) => {
  await requireAdmin();
  const id = str(form, "id");
  const status = str(form, "status") as "active" | "archived" | "draft";
  if (!["active", "archived", "draft"].includes(status)) go(`/admin/events/${id}`, { error: "Invalid status" });
  if (status === "draft") {
    const [[e], [r]] = await Promise.all([
      db.select({ n: count() }).from(giveawayEntries).where(eq(giveawayEntries.eventId, id)),
      db.select({ n: count() }).from(surveyResponses).where(eq(surveyResponses.eventId, id)),
    ]);
    if (Number(e.n) + Number(r.n) > 0) go(`/admin/events/${id}`, { error: "This pop-up already has responses, so it can't go back to draft." });
  }
  await db.transaction(async (tx) => {
    if (status === "active") {
      await tx.update(events).set({ status: "archived", updatedAt: new Date() }).where(and(eq(events.status, "active"), ne(events.id, id)));
    }
    await tx.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, id));
  });
  go(`/admin/events/${id}`, {
    notice: status === "active" ? "Live! The permanent QR code now points here." : status === "archived" ? "Pop-up ended." : "Moved back to draft.",
  });
});

export const approveRulesAction = act(async (form: FormData) => {
  const admin = await requireAdmin();
  const id = str(form, "id");
  if (form.get("confirm") !== "on") go(`/admin/events/${id}`, { error: "Tick the box to confirm you've reviewed the rules." });
  await db.update(events).set({ rulesApprovedAt: new Date(), rulesApprovedBy: admin.id }).where(eq(events.id, id));
  await db.insert(giveawayAuditLog).values({ eventId: id, action: "rules_approved", actorAdminId: admin.id });
  go(`/admin/events/${id}`, { notice: "Official rules approved and published." });
});

/* ─────────────────────────── Giveaway ─────────────────────────── */

async function giveawayStep(form: FormData, fn: (eventId: string, adminId: string) => Promise<unknown>, notice: string) {
  const admin = await requireAdmin();
  const id = str(form, "eventId");
  try {
    await fn(id, admin.id);
  } catch (e) {
    if (e instanceof DrawError) go(`/admin/giveaways/${id}`, { error: e.message });
    throw e;
  }
  go(`/admin/giveaways/${id}`, { notice });
}

export const closeGiveawayAction = act(async (form: FormData) => {
  return giveawayStep(form, (e, a) => closeGiveaway(db, e, a), "Entries closed.");
});
export const drawWinnerAction = act(async (form: FormData) => {
  if (form.get("confirm") !== "on") go(`/admin/giveaways/${str(form, "eventId")}`, { error: "Tick the box to confirm the drawing." });
  return giveawayStep(form, (e, a) => drawWinner(db, e, a), "🎉 Winner drawn! Their contact info is below.");
});
export const markContactedAction = act(async (form: FormData) => {
  return giveawayStep(form, (e, a) => updateWinnerStatus(db, e, a, "contacted"), "Marked as contacted — the claim clock has started.");
});
export const markClaimedAction = act(async (form: FormData) => {
  return giveawayStep(form, (e, a) => updateWinnerStatus(db, e, a, "claimed"), "Prize claimed. 🍪");
});
export const redrawAction = act(async (form: FormData) => {
  const reason = str(form, "reason") as RedrawReason;
  const note = str(form, "note").slice(0, 500);
  if (!(reason in REDRAW_REASONS)) go(`/admin/giveaways/${str(form, "eventId")}`, { error: "Pick a reason for the redraw." });
  return giveawayStep(form, (e, a) => redraw(db, e, a, reason, note), "Alternate winner drawn. The redraw is recorded in the audit log.");
});

/* ─────────────────────────── Flavors ─────────────────────────── */

const flavorForm = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  description: z.string().trim().max(400),
});

export const saveFlavorAction = act(async (form: FormData) => {
  await requireAdmin();
  const id = str(form, "id") || null;
  const parsed = flavorForm.safeParse({ name: str(form, "name"), description: str(form, "description") });
  if (!parsed.success) go("/admin/flavors", { error: parsed.error.issues[0].message });
  const v = parsed.data!;
  if (id) {
    await db.update(flavors).set({ ...v, isActive: form.get("isActive") === "on", updatedAt: new Date() }).where(eq(flavors.id, id));
  } else {
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${flavors.sortOrder}), -1)` }).from(flavors);
    let slug = slugify(v.name) || "flavor";
    if ((await db.select({ id: flavors.id }).from(flavors).where(eq(flavors.slug, slug))).length) slug = `${slug}-${Date.now().toString(36)}`;
    await db.insert(flavors).values({ ...v, slug, sortOrder: Number(max) + 1 });
  }
  go("/admin/flavors", { notice: id ? `${v.name} saved.` : `${v.name} added!` });
});

export const moveFlavorAction = act(async (form: FormData) => {
  await requireAdmin();
  const id = str(form, "id");
  const dir = str(form, "dir") === "up" ? -1 : 1;
  await db.transaction(async (tx) => {
    const all = await tx.select({ id: flavors.id }).from(flavors).orderBy(asc(flavors.sortOrder), asc(flavors.name));
    const i = all.findIndex((f) => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    for (const [k, f] of all.entries()) await tx.update(flavors).set({ sortOrder: k }).where(eq(flavors.id, f.id));
  });
  go("/admin/flavors", {});
});

const ALLOWED_IMAGE = ["image/webp", "image/jpeg", "image/png"];

export const uploadFlavorPhotoAction = act(async (form: FormData) => {
  await requireAdmin();
  const id = str(form, "id");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) go("/admin/flavors", { error: "Choose a photo first." });
  const f = file as File;
  if (!ALLOWED_IMAGE.includes(f.type)) go("/admin/flavors", { error: "Photos must be JPG, PNG or WebP." });
  if (f.size > 1_500_000) go("/admin/flavors", { error: "That photo is too large — try a smaller one." });
  const data = Buffer.from(await f.arrayBuffer());
  // Check magic bytes so a renamed file can't masquerade as an image
  const sig = data.subarray(0, 12).toString("hex");
  const ok = sig.startsWith("ffd8ff") || sig.startsWith("89504e47") || (sig.startsWith("52494646") && data.subarray(8, 12).toString() === "WEBP");
  if (!ok) go("/admin/flavors", { error: "That file doesn't look like a photo." });
  await db.transaction(async (tx) => {
    await tx
      .insert(flavorImages)
      .values({ flavorId: id, mimeType: f.type, data })
      .onConflictDoUpdate({ target: flavorImages.flavorId, set: { mimeType: f.type, data, updatedAt: new Date() } });
    await tx.update(flavors).set({ imageVersion: sql`${flavors.imageVersion} + 1`, updatedAt: new Date() }).where(eq(flavors.id, id));
  });
  go("/admin/flavors", { notice: "Photo updated!" });
});

export const deleteFlavorAction = act(async (form: FormData) => {
  await requireAdmin();
  const id = str(form, "id");
  const [[r], [e]] = await Promise.all([
    db.select({ n: count() }).from(flavorRatings).where(eq(flavorRatings.flavorId, id)),
    db.select({ n: count() }).from(eventFlavors).where(eq(eventFlavors.flavorId, id)),
  ]);
  if (Number(r.n) + Number(e.n) > 0) go("/admin/flavors", { error: "This flavor has history — mark it inactive instead of deleting." });
  await db.delete(flavors).where(eq(flavors.id, id));
  go("/admin/flavors", { notice: "Flavor deleted." });
});

/* ─────────────────────────── Settings & privacy ─────────────────────────── */

export const saveSettingsAction = act(async (form: FormData) => {
  await requireAdmin();
  const parsed = z
    .object({
      sponsorName: z.string().trim().min(2).max(120),
      sponsorContact: z.string().trim().max(200),
      retentionDays: z.coerce.number().int().min(30).max(1095),
      nextPopupNote: z.string().trim().max(300),
    })
    .safeParse({
      sponsorName: str(form, "sponsorName"),
      sponsorContact: str(form, "sponsorContact"),
      retentionDays: str(form, "retentionDays"),
      nextPopupNote: str(form, "nextPopupNote"),
    });
  if (!parsed.success) go("/admin/settings", { error: parsed.error.issues[0].message });
  await db
    .insert(settings)
    .values({ id: 1, ...parsed.data!, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.id, set: { ...parsed.data!, updatedAt: new Date() } });
  go("/admin/settings", { notice: "Settings saved." });
});

export const purgeExpiredAction = act(async () => {
  await requireAdmin();
  const [s] = await db.select().from(settings);
  const days = s?.retentionDays ?? 180;
  const deleted = await db.execute<{ id: string }>(sql`
    delete from giveaway_entries ge using events e
    where ge.event_id = e.id
      and least(e.entry_closes_at, coalesce(e.giveaway_closed_at, e.entry_closes_at)) < now() - make_interval(days => ${days})
      and not exists (
        select 1 from giveaway_draws d
        where d.entry_id = ge.id and d.status in ('selected','contacted')
      )
    returning ge.id`);
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 86400_000)));
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  go("/admin/settings", { notice: `Cleanup done: removed ${deleted.rows.length} expired giveaway entr${deleted.rows.length === 1 ? "y" : "ies"}.` });
});

export const deletePersonAction = act(async (form: FormData) => {
  const admin = await requireAdmin();
  const email = str(form, "email");
  if (!email.includes("@")) go("/admin/settings", { error: "Enter the email address to delete." });
  if (form.get("confirm") !== "on") go("/admin/settings", { error: "Tick the box to confirm the deletion." });
  const removed = await db
    .delete(giveawayEntries)
    .where(eq(giveawayEntries.emailNormalized, normalizeEmail(email)))
    .returning({ eventId: giveawayEntries.eventId });
  for (const r of removed) {
    await db.insert(giveawayAuditLog).values({ eventId: r.eventId, action: "personal_data_deleted", actorAdminId: admin.id, details: { reason: "data deletion request" } });
  }
  go("/admin/settings", {
    notice: removed.length ? `Deleted ${removed.length} entr${removed.length === 1 ? "y" : "ies"} for that person.` : "No entries found for that email.",
  });
});

export const changePasswordAction = act(async (form: FormData) => {
  const admin = await requireAdmin();
  const current = str(form, "current");
  const next = str(form, "next");
  if (next.length < 12) go("/admin/settings", { error: "New password must be at least 12 characters." });
  if (!(await verifyPassword(admin.id, current))) go("/admin/settings", { error: "Current password is incorrect." });
  await db.update(adminUsers).set({ passwordHash: await hashPassword(next) }).where(eq(adminUsers.id, admin.id));
  await logout(true);
  go("/admin/login", {});
});

export const logoutAction = act(async (form: FormData) => {
  await logout(form.get("everywhere") === "on");
  go("/admin/login", {});
});

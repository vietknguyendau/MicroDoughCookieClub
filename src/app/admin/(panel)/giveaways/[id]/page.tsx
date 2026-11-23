import { ActionForm } from "@/components/action-form";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers, events, giveawayAuditLog, giveawayDraws, giveawayEntries } from "@/db/schema";
import { Badge, Notice, PageHeader, Stat, type SP } from "@/components/admin-ui";
import { effectiveCloseAt, giveawayPhase } from "@/lib/services/events";
import { eligibleCount, REDRAW_REASONS } from "@/lib/services/giveaway";
import { formatDateTime } from "@/lib/time";
import { closeGiveawayAction, drawWinnerAction, markClaimedAction, markContactedAction, redrawAction } from "../../actions";

const ACTION_LABEL: Record<string, string> = {
  rules_approved: "Rules approved",
  close_entries: "Entries closed early",
  draw: "Winner drawn",
  redraw: "Alternate winner drawn",
  forfeit: "Previous winner forfeited",
  contacted: "Winner contacted",
  claimed: "Prize claimed",
  personal_data_deleted: "Entrant data deleted on request",
};

export default async function GiveawayDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ev] = await db.select().from(events).where(eq(events.id, id));
  if (!ev) notFound();

  const [eligible, draws, log] = await Promise.all([
    eligibleCount(db, id),
    db
      .select({ d: giveawayDraws, entry: { firstName: giveawayEntries.firstName, email: giveawayEntries.email, phone: giveawayEntries.phone } })
      .from(giveawayDraws)
      .leftJoin(giveawayEntries, eq(giveawayEntries.id, giveawayDraws.entryId))
      .where(eq(giveawayDraws.eventId, id))
      .orderBy(desc(giveawayDraws.drawNumber)),
    db
      .select({ l: giveawayAuditLog, who: adminUsers.name })
      .from(giveawayAuditLog)
      .leftJoin(adminUsers, eq(adminUsers.id, giveawayAuditLog.actorAdminId))
      .where(eq(giveawayAuditLog.eventId, id))
      .orderBy(asc(giveawayAuditLog.createdAt)),
  ]);
  const phase = giveawayPhase(ev);
  const live = draws.find((x) => ["selected", "contacted", "claimed"].includes(x.d.status));
  const now = Date.now();
  const claimDeadline = live?.d.contactedAt ? new Date(live.d.contactedAt.getTime() + ev.claimWindowHours * 3600_000) : null;
  const tz = ev.timezone;

  return (
    <>
      <PageHeader title={`Giveaway: ${ev.name}`} back="/admin/giveaways" />
      <Notice notice={sp.notice} error={sp.error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Status" value={<span className="text-lg capitalize">{phase.replace("_", " ")}</span>} />
        <Stat label="Eligible entries" value={eligible} />
        <Stat label="Entry deadline" value={<span className="text-base">{formatDateTime(effectiveCloseAt(ev), tz)}</span>} />
        <Stat label="Drawing" value={<span className="text-base">{live ? "Done" : formatDateTime(ev.drawingAt, tz)}</span>} />
      </div>

      {phase === "open" && (
        <section className="box mt-5 flex flex-col gap-3 p-5">
          <h2 className="hand-caps text-xl">Close entries early?</h2>
          <p className="text-sm text-crumb">Entries close automatically at the deadline. Only close early if your published rules allow it.</p>
          <ActionForm action={closeGiveawayAction}>
            <input type="hidden" name="eventId" value={ev.id} />
            <button className="btn btn-secondary btn-sm">Close entries now</button>
          </ActionForm>
        </section>
      )}

      {phase === "closed" && !live && (
        <section className="box mt-5 flex flex-col gap-3 p-5">
          <h2 className="hand-caps text-xl">Draw the winner</h2>
          <p className="text-sm">
            The app picks one entry completely at random from all {eligible} eligible entries using a secure random number
            generator. Every entry has the same odds. You can&apos;t choose or re-roll — redraws are only allowed for the
            reasons in the official rules, and every step is permanently logged.
          </p>
          {eligible === 0 ? (
            <p className="font-semibold text-crumb">No eligible entries to draw from.</p>
          ) : (
            <ActionForm action={drawWinnerAction} className="flex flex-col gap-3">
              <input type="hidden" name="eventId" value={ev.id} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirm" className="mt-0.5 h-5 w-5 accent-ink" />
                I&apos;m ready to draw one winner for this giveaway.
              </label>
              <button className="btn btn-primary self-start">🎲 Draw winner</button>
            </ActionForm>
          )}
        </section>
      )}

      {live && (
        <section className="box mt-5 flex flex-col gap-3 border-ink p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="hand-caps text-xl">Winner (draw #{live.d.drawNumber})</h2>
            <Badge tone={live.d.status === "claimed" ? "good" : "live"}>{live.d.status}</Badge>
          </div>
          {live.entry?.email ? (
            <dl className="grid gap-1 text-sm">
              <div><dt className="inline font-bold">Name: </dt><dd className="inline">{live.entry.firstName}</dd></div>
              <div><dt className="inline font-bold">Email: </dt><dd className="inline"><a className="underline" href={`mailto:${live.entry.email}`}>{live.entry.email}</a></dd></div>
              {live.entry.phone && <div><dt className="inline font-bold">Phone: </dt><dd className="inline"><a className="underline" href={`tel:${live.entry.phone}`}>{live.entry.phone}</a></dd></div>}
            </dl>
          ) : (
            <p className="text-sm text-crumb">This winner&apos;s contact data was deleted.</p>
          )}
          <p className="text-xs text-crumb">
            Picked from {live.d.poolSize} eligible entries on {formatDateTime(live.d.drawnAt, tz)}. Keep this private — never post winners&apos; details.
          </p>
          {claimDeadline && live.d.status === "contacted" && (
            <p className="text-sm font-semibold">
              Response deadline: {formatDateTime(claimDeadline, tz)} {now > claimDeadline.getTime() ? "— passed" : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {live.d.status === "selected" && (
              <ActionForm action={markContactedAction}>
                <input type="hidden" name="eventId" value={ev.id} />
                <button className="btn btn-primary btn-sm">Mark contacted</button>
              </ActionForm>
            )}
            {live.d.status !== "claimed" && (
              <ActionForm action={markClaimedAction}>
                <input type="hidden" name="eventId" value={ev.id} />
                <button className="btn btn-secondary btn-sm">Mark prize claimed</button>
              </ActionForm>
            )}
          </div>
          {live.d.status !== "claimed" && (
            <details className="rounded-xl border border-beige bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold">Need to redraw?</summary>
              <ActionForm action={redrawAction} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="eventId" value={ev.id} />
                <label className="block">
                  <span className="field-label">Reason (from the official rules)</span>
                  <select name="reason" className="input" required defaultValue="">
                    <option value="" disabled>Choose a reason…</option>
                    {Object.entries(REDRAW_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Note (optional)</span>
                  <input name="note" className="input" maxLength={500} />
                </label>
                <button className="btn btn-danger btn-sm self-start">Forfeit & draw alternate</button>
              </ActionForm>
            </details>
          )}
        </section>
      )}

      {draws.length > 1 && (
        <section className="mt-5">
          <p className="label-caps mb-2">Previous draws</p>
          <ul className="flex flex-col gap-2 text-sm">
            {draws.filter((x) => x !== live).map((x) => (
              <li key={x.d.id} className="box p-3">
                Draw #{x.d.drawNumber} · {x.entry?.firstName ?? "(deleted)"} · <strong>{x.d.status}</strong>
                {x.d.forfeitReason && <span className="text-crumb"> — {x.d.forfeitReason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <p className="label-caps mb-2">Audit trail (permanent)</p>
        {log.length === 0 ? (
          <p className="text-sm text-crumb">Nothing yet.</p>
        ) : (
          <ol className="box divide-y divide-beige text-sm">
            {log.map(({ l, who }) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span><strong>{ACTION_LABEL[l.action] ?? l.action}</strong>{who ? ` by ${who}` : ""}</span>
                <span className="text-crumb">{formatDateTime(l.createdAt, tz)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

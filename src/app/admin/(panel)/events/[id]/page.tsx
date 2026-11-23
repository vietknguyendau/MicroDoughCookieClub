import { ActionForm } from "@/components/action-form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { eventFlavors, events, flavors, giveawayEntries } from "@/db/schema";
import { Badge, Notice, PageHeader, type SP } from "@/components/admin-ui";
import { OfficialRules } from "@/components/official-rules";
import { loadSettings } from "@/lib/queries";
import { eventUrl, permanentUrl } from "@/lib/qr";
import { giveawayPhase } from "@/lib/services/events";
import { formatDateTime } from "@/lib/time";
import { EventForm } from "../event-form";
import { approveRulesAction, setEventStatusAction } from "../../actions";

export default async function EventDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ev] = await db.select().from(events).where(eq(events.id, id));
  if (!ev) notFound();
  const [all, chosen, [{ n: entryCount }], sponsor] = await Promise.all([
    db.select({ id: flavors.id, name: flavors.name, isActive: flavors.isActive }).from(flavors).orderBy(asc(flavors.sortOrder)),
    db.select({ id: eventFlavors.flavorId }).from(eventFlavors).where(eq(eventFlavors.eventId, id)),
    db.select({ n: count() }).from(giveawayEntries).where(eq(giveawayEntries.eventId, id)),
    loadSettings(),
  ]);
  const locked = !!ev.rulesApprovedAt && Number(entryCount) > 0;
  const phase = giveawayPhase(ev);

  return (
    <>
      <PageHeader title={ev.name} back="/admin/events">
        <Badge tone={ev.status === "active" ? "live" : ev.status === "draft" ? "warn" : "neutral"}>
          {ev.status === "active" ? "● Live" : ev.status === "draft" ? "Draft" : "Ended"}
        </Badge>
      </PageHeader>
      <Notice notice={sp.notice} error={sp.error} />

      {/* Status */}
      <section className="box mb-5 flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">Status</h2>
        <p className="text-sm">
          {ev.status === "active"
            ? "Customers scanning the permanent QR code land on this pop-up."
            : ev.status === "draft"
              ? "Only you can see this pop-up. Go live when you're set up."
              : "This pop-up has ended. Its giveaway stays open online until the entry deadline."}
        </p>
        <div className="flex flex-wrap gap-2">
          {ev.status !== "active" && (
            <ActionForm action={setEventStatusAction}>
              <input type="hidden" name="id" value={ev.id} />
              <input type="hidden" name="status" value="active" />
              <button className="btn btn-primary btn-sm">Go live</button>
            </ActionForm>
          )}
          {ev.status === "active" && (
            <ActionForm action={setEventStatusAction}>
              <input type="hidden" name="id" value={ev.id} />
              <input type="hidden" name="status" value="archived" />
              <button className="btn btn-secondary btn-sm">End pop-up</button>
            </ActionForm>
          )}
          {ev.status !== "draft" && (
            <Link prefetch={false} href={`/event/${ev.slug}`} target="_blank" className="btn btn-secondary btn-sm">View customer page ↗</Link>
          )}
          {ev.giveawayEnabled && (
            <Link prefetch={false} href={`/admin/giveaways/${ev.id}`} className="btn btn-secondary btn-sm">Giveaway ({Number(entryCount)} entries)</Link>
          )}
        </div>
        {ev.giveawayEnabled && !ev.rulesApprovedAt && (
          <p className="text-sm font-semibold text-caramel-dark">⚠ The giveaway won&apos;t accept entries until you approve the official rules below.</p>
        )}
      </section>

      {/* QR */}
      <section className="box mb-5 flex flex-col gap-3 p-5">
        <h2 className="hand-caps text-xl">QR codes & signs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-beige bg-white p-4">
            <p className="font-extrabold text-ink">Permanent QR</p>
            <p className="text-sm text-crumb">Print once, reuse forever. Always opens whichever pop-up is live.</p>
            <p className="mt-1 break-all text-xs">{permanentUrl()}</p>
            <Link prefetch={false} href={`/admin/events/${ev.id}/sign?type=permanent`} className="btn btn-secondary btn-sm mt-3">Print sign</Link>
          </div>
          <div className="rounded-xl border border-beige bg-white p-4">
            <p className="font-extrabold text-ink">This pop-up only</p>
            <p className="text-sm text-crumb">Links straight to this event. Its link never changes.</p>
            <p className="mt-1 break-all text-xs">{eventUrl(ev.slug)}</p>
            <Link prefetch={false} href={`/admin/events/${ev.id}/sign?type=event`} className="btn btn-secondary btn-sm mt-3">Print sign</Link>
          </div>
        </div>
      </section>

      {/* Rules approval */}
      {ev.giveawayEnabled && (
        <section className="box mb-5 flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="hand-caps text-xl">Official rules</h2>
            {ev.rulesApprovedAt ? (
              <Badge tone="good">Approved {formatDateTime(ev.rulesApprovedAt, ev.timezone)}</Badge>
            ) : (
              <Badge tone="warn">Needs your approval</Badge>
            )}
          </div>
          <p className="text-sm text-crumb">
            This is exactly what customers will see. Tip: have someone with legal know-how glance at it once — after that
            you can reuse the same terms.
          </p>
          <details className="rounded-xl border border-beige bg-white p-4" open={!ev.rulesApprovedAt}>
            <summary className="cursor-pointer font-bold">Preview rules</summary>
            <div className="mt-3"><OfficialRules ev={ev} sponsor={sponsor} /></div>
          </details>
          {!sponsor.sponsorContact && (
            <p className="text-sm font-semibold text-berry">
              Add your sponsor contact info in <Link prefetch={false} className="underline" href="/admin/settings">Settings</Link> before approving.
            </p>
          )}
          {!ev.rulesApprovedAt && (
            <ActionForm action={approveRulesAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={ev.id} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="confirm" className="mt-0.5 h-5 w-5 accent-ink" />
                I&apos;ve reviewed these rules and approve publishing them.
              </label>
              <button className="btn btn-primary btn-sm self-start" disabled={!sponsor.sponsorContact}>Approve & publish rules</button>
            </ActionForm>
          )}
          {phase !== "unpublished" && phase !== "disabled" && <p className="text-sm">Giveaway is currently: <strong>{phase.replace("_", " ")}</strong></p>}
        </section>
      )}

      <h2 className="hand-caps mb-3 mt-8 text-2xl">Edit details</h2>
      <EventForm ev={ev} allFlavors={all} selected={chosen.map((c) => c.id)} locked={locked} />
    </>
  );
}

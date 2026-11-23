import Link from "next/link";
import { db } from "@/db";
import { Badge, Empty, PageHeader, Stat, Stars } from "@/components/admin-ui";
import { CookieImage } from "@/components/brand";
import { overview, recentComments } from "@/lib/services/analytics";
import { getActiveEvent, giveawayPhase, effectiveCloseAt } from "@/lib/services/events";
import { formatDateTime } from "@/lib/time";

export default async function AdminHome() {
  const active = await getActiveEvent(db);
  const [stats, all, comments] = await Promise.all([
    active ? overview(db, active.id) : null,
    overview(db, null),
    recentComments(db, 5),
  ]);
  const s = stats ?? all;

  return (
    <>
      <PageHeader title="Hi there!">
        <Link prefetch={false} href="/admin/events/new" className="btn btn-primary btn-sm">+ New pop-up</Link>
      </PageHeader>

      {active ? (
        <section className="box mb-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="live">● Live now</Badge>
            <Badge tone={giveawayPhase(active) === "open" ? "good" : "warn"}>Giveaway: {giveawayPhase(active).replace("_", " ")}</Badge>
          </div>
          <h2 className="mt-2 text-xl font-extrabold text-ink">{active.name}</h2>
          <p className="text-sm text-crumb">
            {formatDateTime(active.startsAt, active.timezone)} · {active.locationName || "Location TBD"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link prefetch={false} href={`/admin/events/${active.id}`} className="btn btn-secondary btn-sm">Edit pop-up</Link>
            <Link prefetch={false} href={`/admin/events/${active.id}/sign`} className="btn btn-secondary btn-sm">Print QR sign</Link>
            <Link prefetch={false} href={`/event/${active.slug}`} className="btn btn-secondary btn-sm" target="_blank">View customer page ↗</Link>
          </div>
        </section>
      ) : (
        <div className="mb-5">
          <Empty title="No pop-up is live right now">
            Create one under <Link prefetch={false} className="underline" href="/admin/events">Pop-ups</Link> and tap “Go live”.
          </Empty>
        </div>
      )}

      <p className="label-caps mb-2">{active ? "This pop-up" : "All-time"}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Giveaway entries" value={s.entries} />
        <Stat label="Surveys" value={s.surveys} />
        <Stat label="Avg rating" value={<Stars value={s.avgRating} />} />
        <Stat
          label="Most loved"
          value={<span className="text-lg">{s.mostPopular?.name ?? "—"}</span>}
          hint={s.mostPopular ? `${s.mostPopular.favorites} favorite vote${s.mostPopular.favorites === 1 ? "" : "s"}` : "No votes yet"}
        />
      </div>

      {active && active.giveawayEnabled && (
        <section className="box mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="label-caps">Upcoming drawing</p>
            <p className="font-extrabold text-ink">{formatDateTime(active.drawingAt, active.timezone)}</p>
            <p className="text-sm text-crumb">Entries close {formatDateTime(effectiveCloseAt(active), active.timezone)}</p>
          </div>
          <Link prefetch={false} href={`/admin/giveaways/${active.id}`} className="btn btn-secondary btn-sm">Manage giveaway</Link>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-caps">Recent comments</p>
          <Link prefetch={false} href="/admin/feedback" className="text-sm font-bold underline">See all</Link>
        </div>
        {comments.length === 0 ? (
          <Empty title="No comments yet">They&apos;ll show up here as customers share.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((c, i) => (
              <li key={i} className="box p-4">
                <p className="whitespace-pre-line">“{c.comments}”</p>
                <p className="mt-1 text-xs text-crumb">{c.eventName} · {formatDateTime(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {all.mostPopular && (
        <section className="mt-6 flex items-center gap-4">
          <CookieImage flavorId={all.mostPopular.flavorId} version={all.mostPopular.imageVersion} name={all.mostPopular.name} className="w-16" size={96} />
          <p className="text-sm">
            All-time fan favorite: <strong>{all.mostPopular.name}</strong>.{" "}
            <Link prefetch={false} href="/admin/doughboard" className="underline">Open the Doughboard →</Link>
          </p>
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { Badge, Empty, PageHeader } from "@/components/admin-ui";
import { formatDateTime } from "@/lib/time";

export default async function EventsPage() {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startsAt: events.startsAt,
      timezone: events.timezone,
      locationName: events.locationName,
      surveys: sql<number>`(select count(*)::int from survey_responses s where s.event_id = ${events.id})`,
      entries: sql<number>`(select count(*)::int from giveaway_entries g where g.event_id = ${events.id})`,
    })
    .from(events)
    .orderBy(desc(events.startsAt));

  return (
    <>
      <PageHeader title="Pop-ups">
        <Link prefetch={false} href="/admin/events/new" className="btn btn-primary btn-sm">+ New pop-up</Link>
      </PageHeader>
      {rows.length === 0 ? (
        <Empty title="No pop-ups yet">Create your first one — it takes about a minute.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Link prefetch={false} href={`/admin/events/${e.id}`} className="box flex flex-wrap items-center justify-between gap-3 p-4 hover:border-caramel">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-ink">{e.name}</span>
                    <Badge tone={e.status === "active" ? "live" : e.status === "draft" ? "warn" : "neutral"}>
                      {e.status === "active" ? "Live" : e.status === "draft" ? "Draft" : "Ended"}
                    </Badge>
                  </div>
                  <p className="text-sm text-crumb">{formatDateTime(e.startsAt, e.timezone)}{e.locationName ? ` · ${e.locationName}` : ""}</p>
                </div>
                <p className="text-sm"><strong>{e.surveys}</strong> surveys · <strong>{e.entries}</strong> entries</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

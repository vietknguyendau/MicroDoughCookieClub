import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { Badge, Empty, PageHeader } from "@/components/admin-ui";
import { giveawayPhase } from "@/lib/services/events";
import { formatDateTime } from "@/lib/time";

export default async function GiveawaysPage() {
  const rows = await db
    .select({
      ev: events,
      eligible: sql<number>`(select count(*)::int from giveaway_entries g where g.event_id = ${events.id} and g.status = 'eligible')`,
      winner: sql<string | null>`(select d.status::text from giveaway_draws d where d.event_id = ${events.id} and d.status in ('selected','contacted','claimed') limit 1)`,
    })
    .from(events)
    .where(eq(events.giveawayEnabled, true))
    .orderBy(desc(events.startsAt));

  return (
    <>
      <PageHeader title="Giveaways" />
      {rows.length === 0 ? (
        <Empty title="No giveaways yet">Each pop-up gets one free 6-pack giveaway.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ ev, eligible, winner }) => {
            const phase = giveawayPhase(ev);
            return (
              <li key={ev.id}>
                <Link prefetch={false} href={`/admin/giveaways/${ev.id}`} className="box flex flex-wrap items-center justify-between gap-3 p-4 hover:border-caramel">
                  <div>
                    <p className="font-extrabold text-ink">{ev.name}</p>
                    <p className="text-sm text-crumb">Draw: {formatDateTime(ev.drawingAt, ev.timezone)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={phase === "open" ? "good" : phase === "unpublished" ? "warn" : "neutral"}>{phase.replace("_", " ")}</Badge>
                    <Badge>{eligible} eligible</Badge>
                    <Badge tone={winner === "claimed" ? "good" : winner ? "live" : "neutral"}>{winner ? `Winner: ${winner}` : "No winner yet"}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

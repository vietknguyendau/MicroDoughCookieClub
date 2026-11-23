import { desc, ne } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";

/** GET form → works without JS, shareable URLs. */
export async function EventFilter({ value, extra }: { value: string; extra?: React.ReactNode }) {
  const list = await db.select({ id: events.id, name: events.name, status: events.status }).from(events).where(ne(events.status, "draft")).orderBy(desc(events.startsAt));
  return (
    <form className="mb-5 flex flex-wrap items-end gap-2">
      <label className="min-w-48 flex-1">
        <span className="label-caps mb-1 block">Show</span>
        <select name="event" defaultValue={value} className="input">
          <option value="current">Current pop-up</option>
          <option value="all">All-time</option>
          {list.map((e) => <option key={e.id} value={e.id}>{e.name}{e.status === "active" ? " (live)" : ""}</option>)}
        </select>
      </label>
      {extra}
      <button className="btn btn-secondary btn-sm">Apply</button>
    </form>
  );
}

export async function resolveEventFilter(value: string | undefined) {
  const v = value ?? "current";
  if (v === "all") return { key: "all", eventId: null as string | null };
  if (v === "current") {
    const { getActiveEvent } = await import("@/lib/services/events");
    const a = await getActiveEvent(db);
    return { key: "current", eventId: a?.id ?? null, noActive: !a };
  }
  return /^[0-9a-f-]{36}$/i.test(v) ? { key: v, eventId: v } : { key: "all", eventId: null };
}

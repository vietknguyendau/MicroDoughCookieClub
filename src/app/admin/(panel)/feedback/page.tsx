import Link from "next/link";
import { db } from "@/db";
import { Empty, PageHeader, type SP } from "@/components/admin-ui";
import { EventFilter, resolveEventFilter } from "@/components/event-filter";
import { listResponses } from "@/lib/services/analytics";
import { formatDateTime } from "@/lib/time";

const BUY: Record<string, string> = { absolutely: "Absolutely!", maybe: "Maybe", probably_not: "Probably not" };
const PAGE = 30;

export default async function FeedbackAdmin({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = await resolveEventFilter(sp.event ?? "all");
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const rows = "noActive" in f && f.noActive ? [] : await listResponses(db, { eventId: f.eventId, q: q || null, limit: PAGE + 1, offset: page * PAGE });
  const hasMore = rows.length > PAGE;
  const exportHref = `/api/admin/export/feedback?event=${f.eventId ?? "all"}`;
  const qs = (p: number) => `?${new URLSearchParams({ event: f.key, q, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Feedback">
        <a href={exportHref} className="btn btn-secondary btn-sm">Export CSV</a>
      </PageHeader>
      <EventFilter
        value={f.key}
        extra={
          <label className="min-w-48 flex-[2]">
            <span className="label-caps mb-1 block">Search comments & suggestions</span>
            <input name="q" defaultValue={q} className="input" placeholder="e.g. matcha, too sweet" />
          </label>
        }
      />
      {rows.length === 0 ? (
        <Empty title={q ? "No matches" : "No feedback yet"}>{q ? "Try a different word." : "Responses appear here in real time."}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.slice(0, PAGE).map((r) => (
            <li key={r.id} className="box p-4">
              <p className="text-xs text-crumb">{r.eventName} · {formatDateTime(r.createdAt, r.eventTz)}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {r.ratings.map((x) => (
                  <li key={x.flavor} className="rounded-full bg-cream px-3 py-1 text-sm">
                    <strong>{x.flavor}</strong> {"★".repeat(x.stars)}<span className="text-beige">{"★".repeat(5 - x.stars)}</span> · {BUY[x.buyAgain]}
                  </li>
                ))}
              </ul>
              {r.favorite && <p className="mt-2 text-sm">♥ Favorite: <strong>{r.favorite}</strong></p>}
              {r.suggestion && <p className="mt-1 text-sm">💡 Bake next: <strong>{r.suggestion}</strong></p>}
              {r.comments && <p className="mt-2 whitespace-pre-line rounded-xl bg-cream/70 p-3">“{r.comments}”</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-between">
        {page > 0 ? <Link prefetch={false} className="btn btn-secondary btn-sm" href={qs(page - 1)}>← Newer</Link> : <span />}
        {hasMore && <Link prefetch={false} className="btn btn-secondary btn-sm" href={qs(page + 1)}>Older →</Link>}
      </div>
    </>
  );
}

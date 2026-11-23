import { db } from "@/db";
import { Badge, Empty, PageHeader, Stars, type SP } from "@/components/admin-ui";
import { CookieImage } from "@/components/brand";
import { EventFilter, resolveEventFilter } from "@/components/event-filter";
import { doughboard, type FlavorStat, type Metric } from "@/lib/services/analytics";

const METRICS: { value: Metric; label: string }[] = [
  { value: "score", label: "Doughboard score (fair)" },
  { value: "avg", label: "Raw average stars" },
  { value: "favorites", label: "Favorite votes" },
  { value: "buyAgain", label: "% would buy again" },
  { value: "ratings", label: "Most tried" },
];

const CONF: Record<FlavorStat["confidence"], { label: string; tone: "neutral" | "warn" | "good" }> = {
  none: { label: "No ratings", tone: "neutral" },
  too_early: { label: "Too early to tell", tone: "warn" },
  early: { label: "Early signal", tone: "neutral" },
  solid: { label: "Solid sample", tone: "good" },
};

export default async function DoughboardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = await resolveEventFilter(sp.event);
  const metric = (METRICS.find((m) => m.value === sp.metric)?.value ?? "score") as Metric;
  const rows = "noActive" in f && f.noActive ? [] : await doughboard(db, f.eventId, metric);
  const anyData = rows.some((r) => r.ratings > 0);

  return (
    <>
      <PageHeader title="The Doughboard" />
      <EventFilter
        value={f.key}
        extra={
          <label className="min-w-48 flex-1">
            <span className="label-caps mb-1 block">Rank by</span>
            <select name="metric" defaultValue={metric} className="input">
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        }
      />

      {!anyData ? (
        <Empty title={"noActive" in f && f.noActive ? "No pop-up is live" : "No ratings yet"}>
          {"noActive" in f && f.noActive ? "Pick a past pop-up or All-time above." : "Once customers rate cookies, the leaderboard fills in."}
        </Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((r, i) => {
            const maxFav = Math.max(1, ...rows.map((x) => x.favorites));
            return (
              <li key={r.flavorId} className="box flex items-center gap-3 p-4">
                <span className="hand-caps w-7 shrink-0 text-center text-2xl">{r.ratings ? i + 1 : "–"}</span>
                <CookieImage flavorId={r.flavorId} version={r.imageVersion} name={r.name} size={96} className="w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-ink">{r.name}</span>
                    <Badge tone={CONF[r.confidence].tone}>{CONF[r.confidence].label}</Badge>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
                    <div><dt className="label-caps">Avg</dt><dd><Stars value={r.avgStars} /></dd></div>
                    <div><dt className="label-caps">Ratings</dt><dd className="font-bold">n = {r.ratings}</dd></div>
                    <div><dt className="label-caps">Buy again</dt><dd className="font-bold">{r.buyAgainPct === null ? "—" : `${Math.round(r.buyAgainPct)}%`}</dd></div>
                    <div><dt className="label-caps">Favorites</dt><dd className="font-bold">{r.favorites}</dd></div>
                  </dl>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-beige" aria-hidden>
                    <div className="h-full rounded-full bg-caramel" style={{ width: `${(r.favorites / maxFav) * 100}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-5 text-xs leading-relaxed text-crumb">
        <strong>How the fair score works:</strong> each cookie starts with 5 imaginary 3.5★ ratings, so one excited 5★
        rating can&apos;t beat a cookie twenty people loved. As real ratings pile up, the imaginary ones stop mattering.
        Under 5 ratings = too early to tell; 15+ = a solid read. “Buy again” counts “Absolutely!” answers only.
      </p>
    </>
  );
}

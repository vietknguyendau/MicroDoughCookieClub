import Link from "next/link";
import { db } from "@/db";
import { Empty, PageHeader, Stars, type SP } from "@/components/admin-ui";
import { CookieImage } from "@/components/brand";
import { EventFilter, resolveEventFilter } from "@/components/event-filter";
import { menuPlan, RULES, VERDICTS, type FlavorInsight, type Verdict } from "@/lib/services/insights";

export const metadata = { title: "Menu planner" };

const TONE: Record<Verdict, string> = {
  star: "border-caramel bg-caramel/10",
  keep: "border-leaf/40 bg-leaf/5",
  later: "border-beige bg-white",
  rethink: "border-berry/40 bg-berry/5",
  needs_data: "border-dashed border-beige bg-cream/50",
};

function Trend({ t }: { t: FlavorInsight["trend"] }) {
  if (!t) return null;
  const map = { up: ["↗", "text-leaf", "trending up"], down: ["↘", "text-berry", "trending down"], flat: ["→", "text-crumb", "steady"] } as const;
  const [icon, cls, label] = map[t];
  return <span className={`text-sm font-extrabold ${cls}`} title={label} aria-label={label}>{icon}</span>;
}

function Spark({ points: all }: { points: FlavorInsight["byEvent"] }) {
  const points = all.slice(-8); // most recent 8 pop-ups
  if (points.length < 2) return null;
  const w = 120, h = 32;
  const xs = (i: number) => (i / (points.length - 1)) * (w - 8) + 4;
  const ys = (v: number) => h - 4 - ((v - 1) / 4) * (h - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.avgStars).toFixed(1)}`).join(" ");
  return (
    <figure className="mt-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Average stars by pop-up: ${points.map((p) => `${p.eventName} ${p.avgStars.toFixed(1)}`).join(", ")}`}>
        <path d={d} fill="none" stroke="#b78a59" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => <circle key={p.eventId} cx={xs(i)} cy={ys(p.avgStars)} r={2.5} fill="#30251f" />)}
      </svg>
      <figcaption className="label-caps !text-[0.6rem]">Avg ★, last {points.length} pop-ups</figcaption>
    </figure>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = await resolveEventFilter(sp.event ?? "all");
  const { insights, suggestions } = "noActive" in f && f.noActive ? { insights: [], suggestions: [] } : await menuPlan(db, f.eventId);
  const rated = insights.filter((i) => i.ratings > 0);
  const groups = (Object.keys(VERDICTS) as Verdict[]).map((v) => ({ v, items: insights.filter((i) => i.verdict === v) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Menu planner" />
      <p className="-mt-3 mb-5 text-sm text-crumb">
        Which cookies to bring every time, which to rest and bring back later, and which need work, based on everything customers told you.
      </p>
      <EventFilter value={f.key} />

      {rated.length === 0 ? (
        <Empty title="No ratings yet">
          Once customers rate cookies at a pop-up, recommendations show up here. <Link className="underline" href="/admin/events">Set up a pop-up →</Link>
        </Empty>
      ) : (
        <>
          {/* At-a-glance summary */}
          <section className="box mb-6 p-5">
            <h2 className="hand-caps mb-3 text-xl">Next menu, at a glance</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {groups.map(({ v, items }) => (
                <li key={v} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-extrabold text-ink">{VERDICTS[v].emoji} {VERDICTS[v].label}:</span>
                  <span>{items.map((i) => i.name).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>

          {groups.map(({ v, items }) => (
            <section key={v} className="mb-7">
              <h2 className="hand-caps text-xl">{VERDICTS[v].emoji} {VERDICTS[v].label}</h2>
              <p className="mb-3 text-sm text-crumb">{VERDICTS[v].advice}</p>
              <ul className="flex flex-col gap-3">
                {items.map((i) => (
                  <li key={i.flavorId} className={`rounded-[var(--radius-card)] border-2 p-4 ${TONE[v]}`}>
                    <div className="flex gap-3">
                      <CookieImage flavorId={i.flavorId} version={i.imageVersion} name={i.name} size={96} className="w-16 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-ink">{i.name}</span>
                          <Trend t={i.trend} />
                          {i.polarizing && <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-extrabold text-cream">DIVISIVE</span>}
                          {!i.isActive && <span className="label-caps">inactive</span>}
                        </div>
                        <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
                          <div><dt className="label-caps">Avg</dt><dd><Stars value={i.avgStars} /></dd></div>
                          <div><dt className="label-caps">Buy again</dt><dd className="font-bold">{i.buyAgainPct === null ? "—" : `${Math.round(i.buyAgainPct)}%`}</dd></div>
                          <div><dt className="label-caps">Ratings</dt><dd className="font-bold">n = {i.ratings}</dd></div>
                        </dl>
                        <ul className="mt-2 list-disc pl-4 text-sm leading-snug">
                          {i.reasons.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                        <Spark points={i.byEvent} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <section className="box mb-6 p-5">
        <h2 className="hand-caps text-xl">💡 What customers want next</h2>
        <p className="mb-3 text-sm text-crumb">Answers to &ldquo;What flavor should we bake next?&rdquo;, with similar answers grouped together.</p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-crumb">No suggestions yet.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {suggestions.map((s, idx) => {
              const max = suggestions[0].count;
              return (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right font-bold text-crumb">{idx + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.label}</span>
                  <span className="h-2 w-24 overflow-hidden rounded-full bg-beige" aria-hidden>
                    <span className="block h-full rounded-full bg-caramel" style={{ width: `${(s.count / max) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-extrabold">{s.count}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <details className="text-xs leading-relaxed text-crumb">
        <summary className="cursor-pointer font-bold">How cookies are sorted</summary>
        <ul className="mt-2 list-disc pl-4">
          <li>⭐ <strong>Bring every time:</strong> fair score ≥ {RULES.star.score} and ≥ {RULES.star.buyAgain}% &ldquo;Absolutely!&rdquo; would buy again.</li>
          <li>👍 <strong>Keep in rotation:</strong> fair score ≥ {RULES.keep.score}.</li>
          <li>🗓️ <strong>Save for later:</strong> fair score {RULES.rethink.score}–{RULES.keep.score}: liked, not loved.</li>
          <li>🔧 <strong>Rethink:</strong> fair score below {RULES.rethink.score}, or under {RULES.rethink.buyAgain}% would buy again.</li>
          <li>🔍 <strong>Needs more tastings:</strong> fewer than {RULES.minRatings} ratings.</li>
          <li>The <strong>fair score</strong> starts every cookie with {RULES.priorWeight} imaginary {RULES.priorMean}★ ratings, so one excited review can&apos;t crown a winner.</li>
          <li><strong>Divisive</strong> means ratings are spread out (standard deviation ≥ {RULES.polarizingStdDev}★). Fans really love it, so it works well as a limited drop.</li>
        </ul>
      </details>
    </>
  );
}

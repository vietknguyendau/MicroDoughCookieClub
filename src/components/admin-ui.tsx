import Link from "next/link";

export function PageHeader({ title, children, back }: { title: string; children?: React.ReactNode; back?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link prefetch={false} href={back} className="label-caps mb-1 inline-block underline">
            ← Back
          </Link>
        )}
        <h1 className="hand-caps text-3xl leading-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Notice({ notice, error }: { notice?: string; error?: string }) {
  if (!notice && !error) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`mb-5 rounded-xl p-3 text-sm font-semibold ${error ? "bg-berry/10 text-berry" : "bg-leaf/10 text-leaf"}`}
    >
      {error ?? notice}
    </p>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="box p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-crumb">{hint}</p>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="box flex flex-col items-center gap-2 p-8 text-center">
      <p className="text-3xl" aria-hidden>🍪</p>
      <p className="font-extrabold text-ink">{title}</p>
      {children && <div className="text-sm text-crumb">{children}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "live"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-beige text-choc",
    good: "bg-leaf/15 text-leaf",
    warn: "bg-caramel/20 text-caramel-dark",
    live: "bg-ink text-cream",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${tones[tone]}`}>{children}</span>;
}

export function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-crumb">—</span>;
  return (
    <span className="whitespace-nowrap font-extrabold text-ink">
      {value.toFixed(1)} <span className="text-caramel" aria-hidden>★</span>
    </span>
  );
}

export type SP = Promise<Record<string, string | undefined>>;

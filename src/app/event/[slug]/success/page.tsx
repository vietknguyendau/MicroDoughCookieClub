import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { PublicShell } from "@/components/public-shell";
import { loadPublicEvent, loadSettings } from "@/lib/queries";
import { effectiveCloseAt } from "@/lib/services/events";
import { SITE } from "@/lib/site";
import { formatDate, formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're in!" };

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ entered?: string }>;
}) {
  const { slug } = await params;
  const entered = (await searchParams).entered !== "0";
  const ev = await loadPublicEvent(slug);
  if (!ev) notFound();
  const s = await loadSettings();

  return (
    <PublicShell eventSlug={slug}>
      <div className="rise flex flex-col items-center text-center">
        <Logo withTagline={false} className="w-32" />
        <p className="mt-8 text-5xl" aria-hidden>🍪</p>
        <h1 className="hand-caps mt-3 text-3xl leading-tight">
          {entered ? "You're in! Good luck, cookie lover!" : "Thanks for the cookie thoughts!"}
        </h1>
        <p className="mt-2 max-w-sm text-crumb">
          {entered
            ? "Your giveaway entry is saved. (Already entered? Don't worry — you're still in once.)"
            : "Your feedback helps decide what gets baked next."}
        </p>
      </div>

      {entered && (
        <dl className="box rise mt-8 grid gap-4 p-5" style={{ animationDelay: "100ms" }}>
          <div>
            <dt className="label-caps">Entries close</dt>
            <dd className="font-bold text-ink">{formatDateTime(effectiveCloseAt(ev), ev.timezone)}</dd>
          </div>
          <div>
            <dt className="label-caps">Winner drawn</dt>
            <dd className="font-bold text-ink">{formatDate(ev.drawingAt, ev.timezone)}</dd>
          </div>
          <div>
            <dt className="label-caps">If you win</dt>
            <dd>
              We&apos;ll email you privately (and text, if you shared a number). Reply within {ev.claimWindowHours}{" "}
              hours to claim your 6-pack.
            </dd>
          </div>
        </dl>
      )}

      {s.nextPopupNote && (
        <div className="box mt-4 p-5">
          <p className="label-caps">Next pop-up</p>
          <p className="mt-1 whitespace-pre-line font-semibold text-ink">{s.nextPopupNote}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <a href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
          Follow @{SITE.instagram} for drops
        </a>
        {!entered && (
          <Link href={`/event/${slug}/enter`} className="btn btn-secondary w-full">
            Actually, enter the giveaway
          </Link>
        )}
      </div>
    </PublicShell>
  );
}

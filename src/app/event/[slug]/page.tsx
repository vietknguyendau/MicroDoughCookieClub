import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo, CookieImage } from "@/components/brand";
import { PublicShell } from "@/components/public-shell";
import { loadEventFlavors, loadPublicEvent } from "@/lib/queries";
import { effectiveCloseAt, feedbackOpen, giveawayPhase } from "@/lib/services/events";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const ev = await loadPublicEvent((await params).slug);
  return { title: ev ? ev.name : "Pop-up" };
}

export default async function WelcomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await loadPublicEvent(slug);
  if (!ev) notFound();
  const flavors = await loadEventFlavors(ev.id);
  const phase = giveawayPhase(ev);
  const canRate = feedbackOpen(ev) && flavors.length > 0;
  const canEnter = phase === "open";

  return (
    <PublicShell eventSlug={slug}>
      <header className="rise flex flex-col items-center text-center">
        <Logo className="w-56 max-w-full" />
        <div className="mt-6 inline-flex flex-col items-center gap-1 rounded-full bg-beige/60 px-5 py-2">
          <span className="font-extrabold text-ink">{ev.name}</span>
          <span className="text-sm">
            {formatDate(ev.startsAt, ev.timezone)} · {formatTimeRange(ev.startsAt, ev.endsAt, ev.timezone)}
          </span>
          {ev.locationName && <span className="text-sm">{ev.locationName}</span>}
        </div>
      </header>

      {flavors.length > 0 && (
        <div className="rise mt-8 grid grid-cols-3 gap-2" style={{ animationDelay: "80ms" }} aria-hidden>
          {flavors.slice(0, 6).map((f) => (
            <CookieImage key={f.id} flavorId={f.id} version={f.imageVersion} name={f.name} size={160} className="w-full" />
          ))}
        </div>
      )}

      <section className="rise mt-8 text-center" style={{ animationDelay: "140ms" }}>
        <h1 className="hand-caps text-4xl leading-tight sm:text-5xl">Rate. Vote. Win.</h1>
        <p className="mx-auto mt-3 max-w-sm text-lg">Share your cookie thoughts for a chance to win a free 6-pack!</p>
      </section>

      <div className="rise mt-7 flex flex-col gap-3" style={{ animationDelay: "200ms" }}>
        {canRate ? (
          <Link href={`/event/${slug}/feedback`} className="btn btn-primary w-full text-lg">
            Rate Our Cookies
          </Link>
        ) : (
          <p className="box p-4 text-center text-sm">Cookie ratings for this pop-up are closed — thanks to everyone who shared!</p>
        )}
        {canEnter && (
          <Link href={`/event/${slug}/enter`} className="btn btn-secondary w-full">
            Enter Giveaway Without Survey
          </Link>
        )}
      </div>

      <section className="box mt-8 p-5 text-sm leading-relaxed">
        <h2 className="hand-caps mb-2 text-lg">The giveaway</h2>
        {phase === "open" && (
          <p>
            One lucky winner gets <strong>{ev.prizeDescription}</strong>. Enter by{" "}
            <strong>{formatDateTime(effectiveCloseAt(ev), ev.timezone)}</strong>. Winner drawn at random on{" "}
            {formatDate(ev.drawingAt, ev.timezone)}.
          </p>
        )}
        {phase === "not_open" && <p>Giveaway entries open {formatDateTime(ev.entryOpensAt, ev.timezone)}.</p>}
        {phase === "closed" && <p>Entries for this giveaway have closed. Thanks for playing!</p>}
        {(phase === "unpublished" || phase === "disabled") && <p>No giveaway is running for this pop-up right now.</p>}
        {(phase === "open" || phase === "not_open") && (
          <p className="mt-3 text-crumb">
            <strong>No purchase or survey necessary.</strong> A purchase or rating won&apos;t improve your chances.{" "}
            {ev.eligibility} See the{" "}
            <Link href={`/rules?event=${slug}`} className="underline">
              official rules
            </Link>
            .
          </p>
        )}
      </section>
    </PublicShell>
  );
}

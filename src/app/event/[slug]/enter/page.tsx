import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell, StepDots } from "@/components/public-shell";
import { loadPublicEvent } from "@/lib/queries";
import { effectiveCloseAt, giveawayPhase } from "@/lib/services/events";
import { issueFormToken } from "@/lib/security";
import { formatDateTime } from "@/lib/time";
import { EntryForm } from "./entry-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enter the giveaway" };

export default async function EnterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const { slug } = await params;
  const afterSurvey = (await searchParams).after === "survey";
  const ev = await loadPublicEvent(slug);
  if (!ev) notFound();
  const phase = giveawayPhase(ev);

  return (
    <PublicShell eventSlug={slug}>
      {afterSurvey && (
        <div className="mb-5 flex items-center justify-between">
          <StepDots step={3} total={3} />
          <span className="label-caps">Giveaway</span>
        </div>
      )}
      {afterSurvey && (
        <p role="status" className="rise mb-5 rounded-xl bg-leaf/10 p-3 text-center font-semibold text-leaf">
          Thanks — your ratings are in! 🍪
        </p>
      )}

      {phase === "open" ? (
        <section className="rise">
          <h1 className="hand-caps text-3xl leading-tight">Your chance to win a free 6-pack!</h1>
          <p className="mt-2 text-crumb">
            Entries close {formatDateTime(effectiveCloseAt(ev), ev.timezone)}. Takes about 20 seconds.
          </p>
          <div className="box mt-6 p-5">
            <EntryForm slug={slug} formToken={issueFormToken()} />
          </div>
          {afterSurvey && (
            <div className="mt-4 text-center">
              <Link href={`/event/${slug}/success?entered=0`} className="btn-quiet">
                No thanks, I&apos;m all done
              </Link>
            </div>
          )}
        </section>
      ) : (
        <div className="box mt-6 p-6 text-center">
          <h1 className="hand-caps text-2xl">
            {phase === "not_open" ? "Entries open soon" : "Entries are closed"}
          </h1>
          <p className="mt-2">
            {phase === "not_open"
              ? `Come back ${formatDateTime(ev.entryOpensAt, ev.timezone)} to enter.`
              : "This giveaway isn't accepting entries right now. Follow along for the next one!"}
          </p>
          <Link href={`/event/${slug}`} className="btn btn-secondary mt-5">Back</Link>
        </div>
      )}
    </PublicShell>
  );
}

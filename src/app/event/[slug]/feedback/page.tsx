import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { loadEventFlavors, loadPublicEvent } from "@/lib/queries";
import { feedbackOpen, giveawayPhase } from "@/lib/services/events";
import { issueFormToken } from "@/lib/security";
import { FeedbackFlow } from "./feedback-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasting card" };

export default async function FeedbackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ev = await loadPublicEvent(slug);
  if (!ev) notFound();
  const flavors = await loadEventFlavors(ev.id);

  if (!feedbackOpen(ev) || flavors.length === 0) {
    return (
      <PublicShell eventSlug={slug}>
        <div className="box mt-10 p-6 text-center">
          <h1 className="hand-caps text-2xl">Ratings are closed</h1>
          <p className="mt-2">Thanks to everyone who shared their cookie thoughts!</p>
          <Link href={`/event/${slug}`} className="btn btn-secondary mt-5">
            Back
          </Link>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell eventSlug={slug}>
      <FeedbackFlow slug={slug} flavors={flavors} formToken={issueFormToken()} giveawayOpen={giveawayPhase(ev) === "open"} />
    </PublicShell>
  );
}

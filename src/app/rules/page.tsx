import Link from "next/link";
import { db } from "@/db";
import { PublicShell } from "@/components/public-shell";
import { OfficialRules } from "@/components/official-rules";
import { loadPublicEvent, loadSettings } from "@/lib/queries";
import { getActiveEvent } from "@/lib/services/events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Official rules" };

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event } = await searchParams;
  const ev = event ? await loadPublicEvent(event) : await getActiveEvent(db);
  const sponsor = await loadSettings();
  return (
    <PublicShell eventSlug={ev?.slug}>
      <h1 className="hand-caps text-3xl">Official rules</h1>
      {ev && ev.rulesApprovedAt && ev.giveawayEnabled ? (
        <>
          <p className="mt-1 text-crumb">{ev.name} — free 6-pack giveaway</p>
          <div className="box mt-5 p-5">
            <OfficialRules ev={ev} sponsor={sponsor} />
          </div>
          <Link href={`/event/${ev.slug}`} className="btn btn-secondary mt-6 w-full">Back to the pop-up</Link>
        </>
      ) : (
        <p className="box mt-5 p-5">There&apos;s no published giveaway here right now. Check back at the next pop-up!</p>
      )}
    </PublicShell>
  );
}

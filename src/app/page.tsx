import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { Bunny, Logo } from "@/components/brand";
import { PublicShell } from "@/components/public-shell";
import { getActiveEvent, listOpenGiveaways } from "@/lib/services/events";
import { loadSettings } from "@/lib/queries";
import { SITE } from "@/lib/site";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/** The PERMANENT QR code points here: it always lands on whatever pop-up is active. */
export default async function Home() {
  const active = await getActiveEvent(db);
  if (active) redirect(`/event/${active.slug}`);
  const [open, s] = await Promise.all([listOpenGiveaways(db), loadSettings()]);

  return (
    <PublicShell>
      <div className="rise flex flex-col items-center pt-6 text-center">
        <Logo className="w-56" />
        <Bunny className="mt-8 h-24 w-auto" />
        <h1 className="hand-caps mt-4 text-3xl">No pop-up today</h1>
        <p className="mt-2 max-w-sm">
          We&apos;re back in the kitchen dreaming up the next batch. Follow along so you don&apos;t miss the next drop!
        </p>
      </div>
      {s.nextPopupNote && (
        <div className="box mt-6 p-5 text-center">
          <p className="label-caps">Next pop-up</p>
          <p className="mt-1 whitespace-pre-line font-semibold text-ink">{s.nextPopupNote}</p>
        </div>
      )}
      {open.length > 0 && (
        <div className="box mt-4 p-5">
          <p className="label-caps">Giveaways still open</p>
          <ul className="mt-2 flex flex-col gap-2">
            {open.map((e) => (
              <li key={e.id}>
                <Link href={`/event/${e.slug}/enter`} className="font-bold underline">{e.name}</Link>
                <span className="text-sm text-crumb"> — enter by {formatDateTime(e.entryClosesAt, e.timezone)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <a href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6 w-full">
        Follow @{SITE.instagram}
      </a>
    </PublicShell>
  );
}

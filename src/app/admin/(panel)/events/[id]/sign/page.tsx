import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { Logo, Bunny } from "@/components/brand";
import { eventUrl, permanentUrl, qrSvg } from "@/lib/qr";
import { siteUrl } from "@/lib/site";
import { PrintButton } from "./print-button";

export default async function SignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const type = (await searchParams).type === "event" ? "event" : "permanent";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ev] = await db.select().from(events).where(eq(events.id, id));
  if (!ev) notFound();
  const url = type === "event" ? eventUrl(ev.slug) : permanentUrl();
  const svg = await qrSvg(url);
  const download = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <PrintButton />
        <a className="btn btn-secondary btn-sm" href={download} download={`microdough-qr-${type === "event" ? ev.slug : "permanent"}.svg`}>
          Download QR (SVG)
        </a>
        <a className="btn btn-secondary btn-sm" href={`/admin/events/${id}`}>Back</a>
        <p className="w-full text-sm text-crumb">Tip: print on letter paper at 100% scale. Test-scan it with your phone before the pop-up!</p>
      </div>

      {/* Letter-size sign */}
      <article className="mx-auto flex aspect-[8.5/11] w-full max-w-[640px] flex-col items-center justify-between rounded-2xl border-2 border-ink bg-[#fbf9f4] p-[6%] text-center print:max-w-none print:rounded-none print:border-0">
        <Logo className="w-[42%]" />
        <div>
          <p className="hand-caps text-[clamp(1.4rem,5vw,2.4rem)] leading-tight">Love your cookies?</p>
          <p className="hand-caps mt-1 text-[clamp(2rem,8vw,3.6rem)] leading-none">Rate. Vote. Win.</p>
        </div>
        <div className="w-[48%] rounded-2xl border-2 border-ink bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="flex items-end gap-3">
          <Bunny className="h-16 w-auto" />
          <p className="hand-caps text-[clamp(1.1rem,4vw,1.8rem)]">Enter to win a free 6&#8209;pack!</p>
        </div>
        <p className="text-[clamp(0.55rem,1.6vw,0.75rem)] leading-snug text-choc">
          No purchase or survey necessary. Purchase won&apos;t improve chances. {ev.eligibility} Enter at the pop-up or online
          at {url.replace(/^https?:\/\//, "")}. Official rules: {siteUrl().replace(/^https?:\/\//, "")}/rules
          {type === "event" ? `?event=${ev.slug}` : ""}
        </p>
      </article>
      <style>{`@page { size: letter; margin: 0.4in; } @media print { header { display:none !important } main { padding:0 !important; max-width:none !important } }`}</style>
    </div>
  );
}

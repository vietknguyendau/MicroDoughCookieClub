import Link from "next/link";
import { Bunny } from "./brand";
import { SITE } from "@/lib/site";

export function PublicShell({ children, eventSlug }: { children: React.ReactNode; eventSlug?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-6">
      <main className="flex-1">{children}</main>
      <footer className="mt-12 flex flex-col items-center gap-3 text-center text-sm text-crumb">
        <Bunny className="h-14 w-auto" />
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link prefetch={false} className="underline underline-offset-2" href={eventSlug ? `/rules?event=${eventSlug}` : "/rules"}>
            Official rules
          </Link>
          <Link prefetch={false} className="underline underline-offset-2" href="/privacy">
            Privacy
          </Link>
          <a className="underline underline-offset-2" href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer">
            @{SITE.instagram}
          </a>
        </nav>
      </footer>
    </div>
  );
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${i + 1 === step ? "w-6 bg-ink" : i + 1 < step ? "w-2 bg-caramel" : "w-2 bg-beige"}`}
        />
      ))}
    </div>
  );
}

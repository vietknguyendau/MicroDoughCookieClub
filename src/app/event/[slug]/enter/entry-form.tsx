"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitEntryAction, type EntryState } from "../actions";

export function EntryForm({ slug, formToken }: { slug: string; formToken: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<EntryState, FormData>(submitEntryAction, null);

  useEffect(() => {
    if (state?.ok) router.push(`/event/${slug}/success`);
  }, [state, router, slug]);

  const err = (f: string) => (state?.field === f ? state.error : undefined);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="eventSlug" value={slug} />
      <input type="hidden" name="t" value={formToken} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <div>
        <label htmlFor="firstName" className="field-label">First name</label>
        <input
          id="firstName" name="firstName" className="input" autoComplete="given-name" required maxLength={50}
          defaultValue={state?.values?.firstName} aria-invalid={!!err("firstName")} aria-describedby={err("firstName") ? "firstName-err" : undefined}
        />
        {err("firstName") && <p id="firstName-err" className="mt-1 text-sm font-semibold text-berry">{err("firstName")}</p>}
      </div>

      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input
          id="email" name="email" type="email" inputMode="email" className="input" autoComplete="email" required maxLength={254}
          defaultValue={state?.values?.email} aria-invalid={!!err("email")} aria-describedby="email-help"
        />
        <p id="email-help" className={`mt-1 text-sm ${err("email") ? "font-semibold text-berry" : "text-crumb"}`}>
          {err("email") ?? "Only used to contact you if you win."}
        </p>
      </div>

      <div>
        <label htmlFor="phone" className="field-label">
          Phone <span className="font-normal text-crumb">(optional)</span>
        </label>
        <input
          id="phone" name="phone" type="tel" inputMode="tel" className="input" autoComplete="tel" maxLength={25}
          defaultValue={state?.values?.phone} aria-invalid={!!err("phone")}
        />
        {err("phone") && <p className="mt-1 text-sm font-semibold text-berry">{err("phone")}</p>}
      </div>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="acceptRules" required defaultChecked={state?.values?.acceptRules} className="mt-1 h-5 w-5 shrink-0 accent-ink" aria-invalid={!!err("acceptRules")} />
        <span className="text-sm">
          I&apos;m 18+, eligible, and agree to the{" "}
          <Link href={`/rules?event=${slug}`} target="_blank" className="font-bold underline">official rules</Link>.
          {err("acceptRules") && <span className="mt-1 block font-semibold text-berry">{err("acceptRules")}</span>}
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" name="marketingOptIn" defaultChecked={state?.values?.marketingOptIn} className="mt-1 h-5 w-5 shrink-0 accent-ink" />
        <span className="text-sm">
          <span className="font-bold">Optional:</span> send me Microdough news and pop-up updates. Not required to enter
          and doesn&apos;t affect your chances.
        </span>
      </label>

      {state?.error && !state.field && (
        <p role="alert" className="rounded-xl bg-berry/10 p-3 text-sm font-semibold text-berry">{state.error}</p>
      )}
      {state?.error && state.field && <p role="alert" className="sr-only">{state.error}</p>}

      <button className="btn btn-primary w-full text-lg" disabled={pending || !!state?.ok}>
        {pending || state?.ok ? "Entering…" : "Enter to win"}
      </button>
      <p className="text-center text-xs text-crumb">
        No purchase, survey, or follow necessary. One entry per person. Every entry has the same odds.{" "}
        <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </form>
  );
}

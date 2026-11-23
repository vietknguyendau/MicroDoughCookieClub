"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CookieImage } from "@/components/brand";
import { PillChoice, StarRating } from "@/components/star-rating";
import { StepDots } from "@/components/public-shell";
import { submitSurveyAction } from "../actions";

type Flavor = { id: string; name: string; description: string; imageVersion: number };
type BuyAgain = "absolutely" | "maybe" | "probably_not";
type Rating = { stars: number; buyAgain: BuyAgain | null };

const BUY_AGAIN: { value: BuyAgain; label: string }[] = [
  { value: "absolutely", label: "Absolutely!" },
  { value: "maybe", label: "Maybe" },
  { value: "probably_not", label: "Probably not" },
];

export function FeedbackFlow({
  slug,
  flavors,
  formToken,
  giveawayOpen,
}: {
  slug: string;
  flavors: Flavor[];
  formToken: string;
  giveawayOpen: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [favorite, setFavorite] = useState<string | null>(null);
  const [nextFlavor, setNextFlavor] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const honeypot = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const tried = flavors.filter((f) => ratings[f.id]);
  const incomplete = tried.filter((f) => !ratings[f.id].stars || !ratings[f.id].buyAgain);

  function toggle(id: string) {
    setError(null);
    setRatings((r) => {
      const next = { ...r };
      if (next[id]) {
        delete next[id];
        if (favorite === id) setFavorite(null);
      } else next[id] = { stars: 0, buyAgain: null };
      return next;
    });
  }

  function goToVote() {
    if (tried.length === 0) return setError("Tap at least one cookie you tried.");
    if (incomplete.length) return setError(`Almost! Finish rating ${incomplete.map((f) => f.name).join(", ")}.`);
    setError(null);
    setStep(2);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitSurveyAction(
        {
          eventSlug: slug,
          ratings: tried.map((f) => ({
            flavorId: f.id,
            stars: ratings[f.id].stars,
            buyAgain: ratings[f.id].buyAgain as BuyAgain,
          })),
          favoriteFlavorId: favorite,
          nextFlavorSuggestion: nextFlavor,
          comments,
        },
        { token: formToken, website: honeypot.current?.value },
      );
      if (!res.ok) return setError(res.error);
      router.push(giveawayOpen ? `/event/${slug}/enter?after=survey` : `/event/${slug}/success?entered=0`);
    });
  }

  return (
    <div ref={topRef} className="scroll-mt-4">
      {/* Honeypot: invisible to people, tempting to bots */}
      <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      <div className="mb-5 flex items-center justify-between">
        <StepDots step={step} total={giveawayOpen ? 3 : 2} />
        <span className="label-caps">{step === 1 ? "Tasting card" : "Your votes"}</span>
      </div>

      {step === 1 && (
        <section className="rise">
          <h1 className="hand-caps text-3xl">Which cookies did you try?</h1>
          <p className="mt-1 text-crumb">Tap every one you tasted, then rate it. Honest thoughts help most!</p>

          <ul className="mt-5 flex flex-col gap-4">
            {flavors.map((f) => {
              const r = ratings[f.id];
              const selected = !!r;
              return (
                <li key={f.id} className={`box overflow-hidden transition-colors ${selected ? "border-ink" : ""}`}>
                  <label className="flex cursor-pointer items-center gap-4 p-4">
                    <CookieImage flavorId={f.id} version={f.imageVersion} name={f.name} size={120} className="w-24 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="hand-caps block text-xl leading-tight">{f.name}</span>
                      <span className="mt-1 block text-sm leading-snug text-crumb">{f.description}</span>
                    </span>
                    <input type="checkbox" checked={selected} onChange={() => toggle(f.id)} className="peer sr-only" />
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-cream transition-colors peer-checked:bg-ink peer-focus-visible:outline-3 peer-focus-visible:outline-caramel"
                    >
                      {selected && (
                        <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                          <path d="M7.7 13.3L4.4 10l-1.2 1.2 4.5 4.5 9.1-9.1-1.2-1.2z" />
                        </svg>
                      )}
                    </span>
                  </label>

                  {selected && (
                    <div className="rise flex flex-col gap-4 border-t border-beige bg-cream/60 px-4 py-4">
                      <div>
                        <p className="mb-1 text-sm font-bold text-ink">How would you rate it?</p>
                        <StarRating
                          label={`Rate ${f.name}`}
                          value={r.stars}
                          onChange={(stars) => setRatings((x) => ({ ...x, [f.id]: { ...x[f.id], stars } }))}
                        />
                      </div>
                      <PillChoice
                        label="Would you buy it again?"
                        options={BUY_AGAIN}
                        value={r.buyAgain}
                        onChange={(buyAgain) => setRatings((x) => ({ ...x, [f.id]: { ...x[f.id], buyAgain } }))}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {step === 2 && (
        <section className="rise flex flex-col gap-7">
          <div>
            <h1 className="hand-caps text-3xl">Which cookie stole your heart?</h1>
            <p className="mt-1 text-crumb">Optional — pick one, or skip.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {tried.map((f) => (
                <label key={f.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="favorite"
                    checked={favorite === f.id}
                    onChange={() => setFavorite(f.id)}
                    className="peer sr-only"
                  />
                  <span className="box flex h-full flex-col items-center gap-2 p-3 text-center transition-colors peer-checked:border-ink peer-checked:bg-beige/50 peer-focus-visible:outline-3 peer-focus-visible:outline-caramel">
                    <CookieImage flavorId={f.id} version={f.imageVersion} name={f.name} size={120} className="w-20" />
                    <span className="hand-caps text-base leading-tight">{f.name}</span>
                    {favorite === f.id && <span className="label-caps text-caramel-dark">♥ My favorite</span>}
                  </span>
                </label>
              ))}
            </div>
            {favorite && (
              <button type="button" className="btn-quiet mt-1" onClick={() => setFavorite(null)}>
                Clear favorite
              </button>
            )}
          </div>

          <div>
            <label htmlFor="next" className="hand-caps block text-2xl">
              What flavor should we bake next?
            </label>
            <input
              id="next"
              className="input mt-2"
              maxLength={200}
              placeholder="Optional — dream big"
              value={nextFlavor}
              onChange={(e) => setNextFlavor(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="comments" className="hand-caps block text-2xl">
              Any sweet thoughts for us?
            </label>
            <p className="text-sm text-crumb">Optional. Love it or not, we want the honest version.</p>
            <textarea
              id="comments"
              className="input mt-2"
              maxLength={1000}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-berry/10 p-3 text-sm font-semibold text-berry">
          {error}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-6 flex gap-3 bg-gradient-to-t from-cream via-cream to-cream/0 px-5 pb-4 pt-6">
        {step === 1 ? (
          <button type="button" className="btn btn-primary w-full" onClick={goToVote}>
            {tried.length ? `Next (${tried.length} tried)` : "Next"}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={pending}>
              Back
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send my ratings"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

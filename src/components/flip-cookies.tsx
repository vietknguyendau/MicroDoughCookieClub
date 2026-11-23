"use client";

import { useState } from "react";
import { CookieImage } from "./brand";

type Flavor = { id: string; name: string; description: string; imageVersion: number };

/** Tap a cookie → it flips over to show its name and description. Tap again to flip back. */
export function FlipCookies({ flavors }: { flavors: Flavor[] }) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {flavors.map((f, i) => {
          const on = !!flipped[f.id];
          return (
            <li key={f.id} className="flip-scene rise" style={{ animationDelay: `${60 + i * 50}ms` }}>
              <button
                type="button"
                onClick={() => setFlipped((s) => ({ ...s, [f.id]: !s[f.id] }))}
                aria-pressed={on}
                aria-label={on ? `${f.name}: ${f.description} Tap to flip back.` : `${f.name}. Tap to read about it.`}
                className="flip-card block aspect-square w-full rounded-[1.4rem] focus-visible:outline-3 focus-visible:outline-caramel"
                data-flipped={on || undefined}
              >
                {/* Front: the cookie */}
                <span className="flip-face flex flex-col items-center justify-center">
                  <CookieImage flavorId={f.id} version={f.imageVersion} name="" size={240} className="w-[88%]" />
                  <span className="hand-caps mt-1 text-[0.8rem] leading-none">{f.name}</span>
                </span>
                {/* Back: the story */}
                <span className="flip-face flip-back flex flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-beige bg-paper px-3 text-center shadow-[var(--shadow-box)]">
                  <span className="hand-caps text-base leading-tight">{f.name}</span>
                  <span className="h-px w-8 bg-caramel" aria-hidden />
                  <span className="text-[0.78rem] leading-snug text-choc">{f.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-center text-xs text-crumb">Tap a cookie to flip it over 🍪</p>
    </div>
  );
}

"use client";

import { useId, useState } from "react";

const LABELS = ["", "Not for me", "It's okay", "Pretty good", "Really good", "Obsessed"];

/** Native radio inputs under the hood: works with keyboard, screen readers, and without animation. */
export function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="sr-only">
              {n} star{n > 1 ? "s" : ""} — {LABELS[n]}
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className={`h-10 w-10 rounded-md peer-focus-visible:outline-3 peer-focus-visible:outline-caramel ${
                n <= shown ? "fill-caramel stroke-caramel-dark" : "fill-transparent stroke-crumb/50"
              } ${value === n ? "pop" : ""}`}
              strokeWidth={1.6}
              strokeLinejoin="round"
            >
              <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6 6.6 19.5l1.1-6.1L3.2 9.2l6.1-.8z" />
            </svg>
          </label>
        ))}
        <span className="ml-2 min-w-20 text-sm font-semibold text-crumb" aria-hidden>
          {LABELS[shown]}
        </span>
      </div>
    </fieldset>
  );
}

export function PillChoice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-11 items-center rounded-full border-2 border-beige bg-white px-4 text-sm font-bold transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-cream peer-focus-visible:outline-3 peer-focus-visible:outline-caramel">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

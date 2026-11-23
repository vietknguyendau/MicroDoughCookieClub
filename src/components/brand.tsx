/* eslint-disable @next/next/no-img-element */
// TEMPORARY brand assets were cropped from Instagram screenshots.
// Replace files in /public/brand with her original logo + bunny artwork (same names, or update paths here).
export const BRAND = {
  logo: "/brand/logo-placeholder.png",
  wordmark: "/brand/wordmark-placeholder.png",
  bunny: "/brand/bunny-placeholder.png",
};

export function Logo({ className = "", withTagline = true }: { className?: string; withTagline?: boolean }) {
  return (
    <img
      src={withTagline ? BRAND.logo : BRAND.wordmark}
      alt={withTagline ? "Microdough — Small Batch. Big Flavor." : "Microdough"}
      className={className}
      width={880}
      height={withTagline ? 760 : 690}
    />
  );
}

export function Bunny({ className = "" }: { className?: string }) {
  return (
    <img
      src={BRAND.bunny}
      alt=""
      aria-hidden
      className={className}
      width={468}
      height={507}
    />
  );
}

export function CookieImage({
  flavorId,
  version,
  name,
  className = "",
  size = 320,
}: {
  flavorId: string;
  version: number;
  name: string;
  className?: string;
  size?: number;
}) {
  if (!version) {
    return (
      <div
        role="img"
        aria-label={`${name} — photo coming soon`}
        className={`grid aspect-square place-items-center rounded-full border-2 border-dashed border-beige bg-cream text-center ${className}`}
      >
        <span className="label-caps px-3">Photo coming soon</span>
      </div>
    );
  }
  return (
    <img
      src={`/api/flavors/${flavorId}/image?v=${version}`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`aspect-square object-contain mix-blend-multiply ${className}`}
    />
  );
}

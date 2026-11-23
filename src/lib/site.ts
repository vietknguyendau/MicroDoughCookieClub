export const SITE = {
  name: "Microdough Cookie Club",
  tagline: "Small Batch. Big Flavor.",
  campaign: "Rate. Vote. Win.",
  instagram: "micro.dough",
  instagramUrl: "https://www.instagram.com/micro.dough/",
};

/** Public base URL used in QR codes. Set NEXT_PUBLIC_SITE_URL in Vercel. */
export function siteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (fromEnv || "http://localhost:3000").replace(/\/$/, "");
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

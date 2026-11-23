import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const surveySchema = z
  .object({
    eventSlug: z.string().min(1).max(100),
    ratings: z
      .array(
        z.object({
          flavorId: z.uuid(),
          stars: z.number().int().min(1).max(5),
          buyAgain: z.enum(["absolutely", "maybe", "probably_not"]),
        }),
      )
      .min(1, "Pick at least one cookie you tried")
      .max(30),
    favoriteFlavorId: z.uuid().nullable().optional(),
    nextFlavorSuggestion: optionalText(200),
    comments: optionalText(1000),
  })
  .refine((v) => new Set(v.ratings.map((r) => r.flavorId)).size === v.ratings.length, {
    message: "Each cookie can only be rated once",
  })
  .refine((v) => !v.favoriteFlavorId || v.ratings.some((r) => r.flavorId === v.favoriteFlavorId), {
    message: "Your favorite has to be one you tried",
  });
export type SurveyInput = z.input<typeof surveySchema>;

export const entrySchema = z.object({
  eventSlug: z.string().min(1).max(100),
  firstName: z.string().trim().min(1, "Please add your first name").max(50),
  email: z.email("Please enter a valid email").trim().max(254),
  phone: z
    .string()
    .trim()
    .max(25)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[0-9+().\-\s]{7,25}$/.test(v), "Please enter a valid phone number"),
  acceptRules: z.literal(true, { error: "Please agree to the official rules" }),
  marketingOptIn: z.boolean().default(false),
});
export type EntryInput = z.input<typeof entrySchema>;

/**
 * One entry per *person*: lowercase, strip "+tags", and ignore dots for Gmail.
 * Used only for duplicate detection — the email as typed is what we store for contact.
 */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

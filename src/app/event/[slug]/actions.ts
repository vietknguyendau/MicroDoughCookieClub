"use server";

import { db } from "@/db";
import { clientIp } from "@/lib/auth";
import { checkFormToken, hashIp, rateLimit } from "@/lib/security";
import { submitSurvey } from "@/lib/services/feedback";
import { submitEntry } from "@/lib/services/giveaway";
import type { SurveyInput } from "@/lib/validation";

type Guard = { token: string; website?: string };

/**
 * Bot screens: hidden "website" honeypot + signed form token. Honeypot hits and
 * forged tokens get a fake success so bots learn nothing. A *real* person who is
 * just very fast (autofill) is asked to tap again — never silently dropped.
 * Per-IP limits are generous because many phones at a pop-up share one carrier IP.
 */
async function screen(bucket: string, guard: Guard, minMs: number, limit: number) {
  if (guard.website) return "bot" as const;
  const t = checkFormToken(guard.token, minMs);
  if (t === "invalid") return "bot" as const;
  if (t === "too_fast") return "too_fast" as const;
  const rl = await rateLimit(db, bucket, hashIp(await clientIp()), limit, 10 * 60);
  if (!rl.ok) return "limited" as const;
  return "ok" as const;
}

export async function submitSurveyAction(input: SurveyInput, guard: Guard) {
  const s = await screen("survey", guard, 3_000, 40);
  if (s === "bot") return { ok: true as const };
  if (s === "limited") return { ok: false as const, error: "Lots of activity from this network — please try again in a few minutes." };
  if (s === "too_fast") return { ok: false as const, error: "Whoa, speedy! Give it a second and tap Send again." };
  return submitSurvey(db, input);
}

export type EntryState = {
  ok?: boolean;
  error?: string;
  field?: string;
  values?: { firstName: string; email: string; phone: string; acceptRules?: boolean; marketingOptIn?: boolean };
} | null;

export async function submitEntryAction(_prev: EntryState, form: FormData): Promise<EntryState> {
  const values = {
    firstName: String(form.get("firstName") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
  };
  const checks = { acceptRules: form.get("acceptRules") === "on", marketingOptIn: form.get("marketingOptIn") === "on" };
  const s = await screen("entry", { token: String(form.get("t") ?? ""), website: String(form.get("website") ?? "") }, 2_000, 30);
  if (s === "bot") return { ok: true };
  if (s === "limited") return { error: "Lots of activity from this network — please try again in a few minutes.", values: { ...values, ...checks } };
  if (s === "too_fast") return { error: "Whoa, speedy! Give it a second and tap Enter again.", values: { ...values, ...checks } };
  const res = await submitEntry(db, {
    eventSlug: String(form.get("eventSlug") ?? ""),
    ...values,
    acceptRules: checks.acceptRules as true, // validated by zod: must be true
    marketingOptIn: checks.marketingOptIn,
  });
  if (!res.ok) return { error: res.error, field: res.field, values: { ...values, ...checks } };
  return { ok: true };
}

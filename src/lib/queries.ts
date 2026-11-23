import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getEventFlavors, getPublicEvent } from "@/lib/services/events";

export const loadPublicEvent = cache((slug: string) => getPublicEvent(db, slug));
export const loadEventFlavors = cache((eventId: string) => getEventFlavors(db, eventId));
export const loadSettings = cache(async () => {
  const [row] = await db.select().from(settings).limit(1);
  return row ?? { sponsorName: "Emmy Le d/b/a Microdough", sponsorContact: "Instagram @micro.dough — instagram.com/micro.dough", instagramHandle: "micro.dough", retentionDays: 180, nextPopupNote: "" };
});

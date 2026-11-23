import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

/* ───────────── Admin ───────────── */

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // stored lowercase
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    // SHA-256 of the random session token; the raw token only lives in the cookie.
    id: text("id").primaryKey(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_admin_idx").on(t.adminId)],
);

/* ───────────── Settings (single row, id = 1) ───────────── */

export const settings = pgTable(
  "settings",
  {
    id: smallint("id").primaryKey().default(1),
    sponsorName: text("sponsor_name").notNull().default("Microdough"),
    sponsorContact: text("sponsor_contact").notNull().default(""),
    instagramHandle: text("instagram_handle").notNull().default("micro.dough"),
    retentionDays: integer("retention_days").notNull().default(180),
    nextPopupNote: text("next_popup_note").notNull().default(""), // shown on the confirmation page
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);

/* ───────────── Flavors ───────────── */

export const flavors = pgTable(
  "flavors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    imageVersion: integer("image_version").notNull().default(0), // 0 = no photo yet
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("flavors_sort_idx").on(t.sortOrder)],
);

// Images are kept out of the flavors table so list queries never load blobs.
export const flavorImages = pgTable("flavor_images", {
  flavorId: uuid("flavor_id")
    .primaryKey()
    .references(() => flavors.id, { onDelete: "cascade" }),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ───────────── Events ───────────── */

export const eventStatus = pgEnum("event_status", ["draft", "active", "archived"]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    locationName: text("location_name").notNull().default(""),
    locationAddress: text("location_address").notNull().default(""),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    timezone: text("timezone").notNull().default("America/Chicago"),
    status: eventStatus("status").notNull().default("draft"),

    // Giveaway configuration (exactly one giveaway per event)
    giveawayEnabled: boolean("giveaway_enabled").notNull().default(true),
    entryOpensAt: ts("entry_opens_at").notNull(),
    entryClosesAt: ts("entry_closes_at").notNull(),
    drawingAt: ts("drawing_at").notNull(),
    claimWindowHours: integer("claim_window_hours").notNull().default(48),
    prizeDescription: text("prize_description").notNull().default("One free six-pack of Microdough cookies"),
    prizeValueCents: integer("prize_value_cents").notNull().default(2400),
    eligibility: text("eligibility")
      .notNull()
      .default("Open to legal residents of Minnesota who are 18 years of age or older."),
    fulfillment: text("fulfillment")
      .notNull()
      .default("Prize pickup will be arranged privately with Microdough in the Minneapolis area."),
    additionalRules: text("additional_rules").notNull().default(""),
    giveawayClosedAt: ts("giveaway_closed_at"), // manual early close
    rulesApprovedAt: ts("rules_approved_at"),
    rulesApprovedBy: uuid("rules_approved_by").references(() => adminUsers.id, { onDelete: "set null" }),

    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // At most one active pop-up, so the permanent QR code is never ambiguous.
    uniqueIndex("events_one_active").on(t.status).where(sql`${t.status} = 'active'`),
    index("events_starts_idx").on(t.startsAt),
    check("events_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    check("events_entry_order", sql`${t.entryClosesAt} > ${t.entryOpensAt}`),
    check("events_draw_after_close", sql`${t.drawingAt} >= ${t.entryClosesAt}`),
    check("events_prize_value", sql`${t.prizeValueCents} >= 0`),
  ],
);

export const eventFlavors = pgTable(
  "event_flavors",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    flavorId: uuid("flavor_id")
      .notNull()
      .references(() => flavors.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.flavorId] })],
);

/* ───────────── Anonymous feedback (no PII) ───────────── */

export const buyAgain = pgEnum("buy_again", ["absolutely", "maybe", "probably_not"]);

export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    comments: text("comments"),
    createdAt: createdAt(),
  },
  (t) => [index("survey_event_idx").on(t.eventId, t.createdAt)],
);

export const flavorRatings = pgTable(
  "flavor_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: uuid("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    flavorId: uuid("flavor_id")
      .notNull()
      .references(() => flavors.id, { onDelete: "restrict" }),
    stars: smallint("stars").notNull(),
    buyAgain: buyAgain("buy_again").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ratings_one_per_flavor").on(t.responseId, t.flavorId),
    index("ratings_event_flavor_idx").on(t.eventId, t.flavorId),
    check("ratings_stars_range", sql`${t.stars} between 1 and 5`),
  ],
);

export const flavorVotes = pgTable(
  "flavor_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    responseId: uuid("response_id")
      .notNull()
      .unique()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    favoriteFlavorId: uuid("favorite_flavor_id").references(() => flavors.id, { onDelete: "restrict" }),
    nextFlavorSuggestion: text("next_flavor_suggestion"),
    createdAt: createdAt(),
  },
  (t) => [index("votes_event_idx").on(t.eventId, t.favoriteFlavorId)],
);

/* ───────────── Giveaway (PII lives only here) ───────────── */

export const entryStatus = pgEnum("entry_status", ["eligible", "disqualified"]);

export const giveawayEntries = pgTable(
  "giveaway_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    phone: text("phone"),
    rulesAcceptedAt: ts("rules_accepted_at").notNull(),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    status: entryStatus("status").notNull().default("eligible"),
    disqualifiedReason: text("disqualified_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("entries_one_per_email_per_event").on(t.eventId, t.emailNormalized),
    index("entries_event_idx").on(t.eventId, t.status),
    index("entries_email_idx").on(t.emailNormalized),
  ],
);

export const drawStatus = pgEnum("draw_status", ["selected", "contacted", "claimed", "forfeited"]);

export const giveawayDraws = pgTable(
  "giveaway_draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    // set null so a data-deletion request never breaks the audit history
    entryId: uuid("entry_id").references(() => giveawayEntries.id, { onDelete: "set null" }),
    drawNumber: integer("draw_number").notNull(),
    poolSize: integer("pool_size").notNull(),
    method: text("method").notNull().default("node:crypto.randomInt"),
    status: drawStatus("status").notNull().default("selected"),
    drawnBy: uuid("drawn_by").references(() => adminUsers.id, { onDelete: "set null" }),
    drawnAt: ts("drawn_at").notNull().defaultNow(),
    contactedAt: ts("contacted_at"),
    claimedAt: ts("claimed_at"),
    forfeitedAt: ts("forfeited_at"),
    forfeitReason: text("forfeit_reason"),
  },
  (t) => [
    uniqueIndex("draws_number_per_event").on(t.eventId, t.drawNumber),
    // The database itself refuses a second live winner for the same event.
    uniqueIndex("draws_one_live_winner")
      .on(t.eventId)
      .where(sql`${t.status} in ('selected','contacted','claimed')`),
  ],
);

// Append-only. A trigger in migration 0001 rejects UPDATE and DELETE.
export const giveawayAuditLog = pgTable(
  "giveaway_audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: uuid("event_id").notNull(),
    drawId: uuid("draw_id"),
    action: text("action").notNull(),
    actorAdminId: uuid("actor_admin_id"),
    details: jsonb("details").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_event_idx").on(t.eventId, t.createdAt)],
);

/* ───────────── Abuse protection ───────────── */

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), // bucket:sha256(ip)
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull().defaultNow(),
});

CREATE TYPE "public"."buy_again" AS ENUM('absolutely', 'maybe', 'probably_not');--> statement-breakpoint
CREATE TYPE "public"."draw_status" AS ENUM('selected', 'contacted', 'claimed', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('eligible', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "event_flavors" (
	"event_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_flavors_event_id_flavor_id_pk" PRIMARY KEY("event_id","flavor_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"location_name" text DEFAULT '' NOT NULL,
	"location_address" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"giveaway_enabled" boolean DEFAULT true NOT NULL,
	"entry_opens_at" timestamp with time zone NOT NULL,
	"entry_closes_at" timestamp with time zone NOT NULL,
	"drawing_at" timestamp with time zone NOT NULL,
	"claim_window_hours" integer DEFAULT 48 NOT NULL,
	"prize_description" text DEFAULT 'One free six-pack of Microdough cookies' NOT NULL,
	"prize_value_cents" integer DEFAULT 2400 NOT NULL,
	"eligibility" text DEFAULT 'Open to legal residents of Minnesota who are 18 years of age or older.' NOT NULL,
	"fulfillment" text DEFAULT 'Prize pickup will be arranged privately with Microdough in the Minneapolis area.' NOT NULL,
	"additional_rules" text DEFAULT '' NOT NULL,
	"giveaway_closed_at" timestamp with time zone,
	"rules_approved_at" timestamp with time zone,
	"rules_approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug"),
	CONSTRAINT "events_time_order" CHECK ("events"."ends_at" > "events"."starts_at"),
	CONSTRAINT "events_entry_order" CHECK ("events"."entry_closes_at" > "events"."entry_opens_at"),
	CONSTRAINT "events_draw_after_close" CHECK ("events"."drawing_at" >= "events"."entry_closes_at"),
	CONSTRAINT "events_prize_value" CHECK ("events"."prize_value_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "flavor_images" (
	"flavor_id" uuid PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flavor_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"flavor_id" uuid NOT NULL,
	"stars" smallint NOT NULL,
	"buy_again" "buy_again" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_stars_range" CHECK ("flavor_ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "flavor_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"favorite_flavor_id" uuid,
	"next_flavor_suggestion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flavor_votes_response_id_unique" UNIQUE("response_id")
);
--> statement-breakpoint
CREATE TABLE "flavors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flavors_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "giveaway_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"draw_id" uuid,
	"action" text NOT NULL,
	"actor_admin_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "giveaway_draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"entry_id" uuid,
	"draw_number" integer NOT NULL,
	"pool_size" integer NOT NULL,
	"method" text DEFAULT 'node:crypto.randomInt' NOT NULL,
	"status" "draw_status" DEFAULT 'selected' NOT NULL,
	"drawn_by" uuid,
	"drawn_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contacted_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"forfeited_at" timestamp with time zone,
	"forfeit_reason" text
);
--> statement-breakpoint
CREATE TABLE "giveaway_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"phone" text,
	"rules_accepted_at" timestamp with time zone NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"status" "entry_status" DEFAULT 'eligible' NOT NULL,
	"disqualified_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"sponsor_name" text DEFAULT 'Microdough' NOT NULL,
	"sponsor_contact" text DEFAULT '' NOT NULL,
	"instagram_handle" text DEFAULT 'micro.dough' NOT NULL,
	"retention_days" integer DEFAULT 180 NOT NULL,
	"next_popup_note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flavors" ADD CONSTRAINT "event_flavors_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_flavors" ADD CONSTRAINT "event_flavors_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_rules_approved_by_admin_users_id_fk" FOREIGN KEY ("rules_approved_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_images" ADD CONSTRAINT "flavor_images_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_ratings" ADD CONSTRAINT "flavor_ratings_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_ratings" ADD CONSTRAINT "flavor_ratings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_ratings" ADD CONSTRAINT "flavor_ratings_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_votes" ADD CONSTRAINT "flavor_votes_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_votes" ADD CONSTRAINT "flavor_votes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flavor_votes" ADD CONSTRAINT "flavor_votes_favorite_flavor_id_flavors_id_fk" FOREIGN KEY ("favorite_flavor_id") REFERENCES "public"."flavors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_draws" ADD CONSTRAINT "giveaway_draws_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_draws" ADD CONSTRAINT "giveaway_draws_entry_id_giveaway_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."giveaway_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_draws" ADD CONSTRAINT "giveaway_draws_drawn_by_admin_users_id_fk" FOREIGN KEY ("drawn_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_one_active" ON "events" USING btree ("status") WHERE "events"."status" = 'active';--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_one_per_flavor" ON "flavor_ratings" USING btree ("response_id","flavor_id");--> statement-breakpoint
CREATE INDEX "ratings_event_flavor_idx" ON "flavor_ratings" USING btree ("event_id","flavor_id");--> statement-breakpoint
CREATE INDEX "votes_event_idx" ON "flavor_votes" USING btree ("event_id","favorite_flavor_id");--> statement-breakpoint
CREATE INDEX "flavors_sort_idx" ON "flavors" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "audit_event_idx" ON "giveaway_audit_log" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "draws_number_per_event" ON "giveaway_draws" USING btree ("event_id","draw_number");--> statement-breakpoint
CREATE UNIQUE INDEX "draws_one_live_winner" ON "giveaway_draws" USING btree ("event_id") WHERE "giveaway_draws"."status" in ('selected','contacted','claimed');--> statement-breakpoint
CREATE UNIQUE INDEX "entries_one_per_email_per_event" ON "giveaway_entries" USING btree ("event_id","email_normalized");--> statement-breakpoint
CREATE INDEX "entries_event_idx" ON "giveaway_entries" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "entries_email_idx" ON "giveaway_entries" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "survey_event_idx" ON "survey_responses" USING btree ("event_id","created_at");
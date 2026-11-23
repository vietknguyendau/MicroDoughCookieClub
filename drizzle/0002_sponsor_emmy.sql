ALTER TABLE "settings" ALTER COLUMN "sponsor_name" SET DEFAULT 'Emmy Le d/b/a Microdough';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "sponsor_contact" SET DEFAULT 'Instagram @micro.dough — instagram.com/micro.dough';--> statement-breakpoint
UPDATE "settings" SET "sponsor_name" = 'Emmy Le d/b/a Microdough', "sponsor_contact" = 'Instagram @micro.dough — instagram.com/micro.dough' WHERE "id" = 1 AND "sponsor_name" = 'Microdough' AND "sponsor_contact" = '';

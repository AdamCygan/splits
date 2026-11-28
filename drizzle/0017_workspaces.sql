CREATE TABLE "workspace_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workday_target_minutes" smallint DEFAULT 480 NOT NULL,
	"working_days" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"time_rounding_minutes" smallint DEFAULT 0 NOT NULL,
	"summary_template" text,
	"break_minutes" smallint DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_settings_break" CHECK ("workspace_settings"."break_minutes" between 0 and 240),
	CONSTRAINT "workspace_settings_target" CHECK ("workspace_settings"."workday_target_minutes" between 0 and 1440),
	CONSTRAINT "workspace_settings_rounding" CHECK ("workspace_settings"."time_rounding_minutes" in (0, 1, 5, 10, 15, 30))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_name" CHECK (char_length("workspaces"."name") between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_break";--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_target";--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_rounding";--> statement-breakpoint
DROP INDEX "breaks_user_date";--> statement-breakpoint
DROP INDEX "days_off_user_date";--> statement-breakpoint
DROP INDEX "projects_name_key";--> statement-breakpoint
DROP INDEX "projects_key_key";--> statement-breakpoint
DROP INDEX "quick_templates_hotkey_key";--> statement-breakpoint
DROP INDEX "sprints_user_start_idx";--> statement-breakpoint
DROP INDEX "story_point_scale_points_key";--> statement-breakpoint
DROP INDEX "tags_name_key";--> statement-breakpoint
DROP INDEX "task_statuses_name_key";--> statement-breakpoint
DROP INDEX "task_statuses_default_key";--> statement-breakpoint
DROP INDEX "task_types_name_key";--> statement-breakpoint
DROP INDEX "time_entries_user_date_idx";--> statement-breakpoint
DROP INDEX "time_entries_user_link_idx";--> statement-breakpoint
DROP INDEX "time_entries_user_paused_idx";--> statement-breakpoint
ALTER TABLE "breaks" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "days_off" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "quick_templates" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "sprint_cadences" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "sprints" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "story_point_scale" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "task_statuses" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "task_statuses" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "task_types" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "task_types" ADD COLUMN "sync_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "workspace_apply" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "ask_workspace_daily" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Każde istniejące konto dostaje jedną przestrzeń; jego dane i ustawienia dnia przechodzą do niej.
INSERT INTO "workspaces" ("user_id", "name", "color")
SELECT u."id", CASE WHEN s."locale" = 'pl' THEN 'Moja przestrzeń' ELSE 'My workspace' END, '#3D3BF3'
FROM "users" u LEFT JOIN "user_settings" s ON s."user_id" = u."id";--> statement-breakpoint
INSERT INTO "workspace_settings" ("workspace_id", "user_id", "workday_target_minutes", "working_days", "time_rounding_minutes", "summary_template", "break_minutes")
SELECT w."id", w."user_id", s."workday_target_minutes", s."working_days", s."time_rounding_minutes", s."summary_template", s."break_minutes"
FROM "workspaces" w JOIN "user_settings" s ON s."user_id" = w."user_id";--> statement-breakpoint
UPDATE "breaks" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "breaks" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "days_off" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "days_off" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "projects" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "quick_templates" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "quick_templates" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "sprints" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "sprints" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "story_point_scale" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "story_point_scale" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "tags" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "task_statuses" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "task_statuses" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "task_types" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "task_types" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "time_entries" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
UPDATE "sprint_cadences" x SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = x."user_id";--> statement-breakpoint
ALTER TABLE "sprint_cadences" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sprint_cadences" DROP CONSTRAINT "sprint_cadences_pkey";--> statement-breakpoint
ALTER TABLE "sprint_cadences" ADD PRIMARY KEY ("workspace_id");--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_name_key" ON "workspaces" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days_off" ADD CONSTRAINT "days_off_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_templates" ADD CONSTRAINT "quick_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_cadences" ADD CONSTRAINT "sprint_cadences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_point_scale" ADD CONSTRAINT "story_point_scale_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sprints_sync_key" ON "sprints" USING btree ("workspace_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_sync_key" ON "tags" USING btree ("workspace_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_statuses_sync_key" ON "task_statuses" USING btree ("workspace_id","sync_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_sync_key" ON "task_types" USING btree ("workspace_id","sync_id");--> statement-breakpoint
CREATE INDEX "breaks_user_date" ON "breaks" USING btree ("workspace_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "days_off_user_date" ON "days_off" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_key" ON "projects" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "projects_key_key" ON "projects" USING btree ("workspace_id","key") WHERE "projects"."key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "quick_templates_hotkey_key" ON "quick_templates" USING btree ("workspace_id","hotkey") WHERE "quick_templates"."hotkey" is not null;--> statement-breakpoint
CREATE INDEX "sprints_user_start_idx" ON "sprints" USING btree ("workspace_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "story_point_scale_points_key" ON "story_point_scale" USING btree ("workspace_id","points");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_key" ON "tags" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "task_statuses_name_key" ON "task_statuses" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "task_statuses_default_key" ON "task_statuses" USING btree ("workspace_id") WHERE "task_statuses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("workspace_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_user_link_idx" ON "time_entries" USING btree ("workspace_id","link");--> statement-breakpoint
CREATE INDEX "time_entries_user_paused_idx" ON "time_entries" USING btree ("workspace_id","work_date") WHERE "time_entries"."paused";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "workday_target_minutes";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "working_days";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "time_rounding_minutes";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "summary_template";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "break_minutes";
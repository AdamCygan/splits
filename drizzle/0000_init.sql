CREATE TYPE "public"."auth_token_purpose" AS ENUM('email_verification', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."field_requirement" AS ENUM('hidden', 'optional', 'required');--> statement-breakpoint
CREATE TYPE "public"."plan_code" AS ENUM('free', 'pro', 'lifetime');--> statement-breakpoint
CREATE TYPE "public"."status_category" AS ENUM('todo', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('task', 'code_review', 'pair_programming', 'additional_work', 'meeting', 'custom');--> statement-breakpoint
CREATE TYPE "public"."time_input_mode" AS ENUM('range', 'duration');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'manager', 'admin');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "external_logins" (
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_logins_provider_provider_user_id_pk" PRIMARY KEY("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key" text,
	"color" text NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quick_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_type_id" uuid NOT NULL,
	"project_id" uuid,
	"label" text NOT NULL,
	"title" text NOT NULL,
	"story_points" numeric(4, 1),
	"default_duration_minutes" integer,
	"hotkey" smallint,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sprint_cadences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"length_days" smallint NOT NULL,
	"anchor_date" date NOT NULL,
	"name_pattern" text NOT NULL,
	"auto_create" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer,
	"name" text NOT NULL,
	"goal" text,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"capacity_story_points" numeric(4, 1),
	"from_cadence" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sprints_dates" CHECK ("sprints"."ends_on" >= "sprints"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "story_point_scale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"points" numeric(4, 1) NOT NULL,
	"max_minutes" integer NOT NULL,
	CONSTRAINT "story_point_scale_range" CHECK ("story_point_scale"."points" > 0 and "story_point_scale"."points" <= 100 and "story_point_scale"."max_minutes" between 1 and 100000)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "status_category" NOT NULL,
	"color" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "task_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "task_kind" NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"title_label" text NOT NULL,
	"link_requirement" "field_requirement" DEFAULT 'optional' NOT NULL,
	"link_label" text DEFAULT 'Link' NOT NULL,
	"description_requirement" "field_requirement" DEFAULT 'optional' NOT NULL,
	"story_points_requirement" "field_requirement" DEFAULT 'optional' NOT NULL,
	"default_story_points" numeric(4, 1),
	"default_time_input" time_input_mode DEFAULT 'duration' NOT NULL,
	"counts_as_focus_work" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_types_sp_default" CHECK (("task_types"."story_points_requirement" <> 'hidden' or "task_types"."default_story_points" is null)
        and ("task_types"."story_points_requirement" <> 'required' or "task_types"."default_story_points" is not null))
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_type_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"link" text,
	"story_points" numeric(4, 1),
	"work_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"duration_minutes" integer NOT NULL,
	"note" text,
	"running" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entries_limits" CHECK (char_length("time_entries"."title") between 1 and 200
        and ("time_entries"."link" is null or char_length("time_entries"."link") <= 2048)
        and ("time_entries"."note" is null or char_length("time_entries"."note") <= 2000)
        and "time_entries"."duration_minutes" between 0 and 1440)
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"workday_target_minutes" smallint DEFAULT 480 NOT NULL,
	"working_days" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"week_starts_on" smallint DEFAULT 1 NOT NULL,
	"time_rounding_minutes" smallint DEFAULT 0 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"daily_reminder_at" text,
	"summary_template" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_target" CHECK ("user_settings"."workday_target_minutes" between 0 and 1440),
	CONSTRAINT "user_settings_week_start" CHECK ("user_settings"."week_starts_on" between 0 and 6),
	CONSTRAINT "user_settings_rounding" CHECK ("user_settings"."time_rounding_minutes" in (0, 1, 5, 10, 15, 30))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"plan" "plan_code" DEFAULT 'free' NOT NULL,
	"display_name" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"failed_login_count" smallint DEFAULT 0 NOT NULL,
	"lockout_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_display_name_len" CHECK (char_length("users"."display_name") between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_logins" ADD CONSTRAINT "external_logins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_templates" ADD CONSTRAINT "quick_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_templates" ADD CONSTRAINT "quick_templates_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_templates" ADD CONSTRAINT "quick_templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_cadences" ADD CONSTRAINT "sprint_cadences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_point_scale" ADD CONSTRAINT "story_point_scale_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_type_id_task_types_id_fk" FOREIGN KEY ("task_type_id") REFERENCES "public"."task_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_logins_user_idx" ON "external_logins" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_key" ON "projects" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "projects_key_key" ON "projects" USING btree ("user_id","key") WHERE "projects"."key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "quick_templates_hotkey_key" ON "quick_templates" USING btree ("user_id","hotkey") WHERE "quick_templates"."hotkey" is not null;--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sprints_user_start_idx" ON "sprints" USING btree ("user_id","starts_on");--> statement-breakpoint
CREATE UNIQUE INDEX "story_point_scale_points_key" ON "story_point_scale" USING btree ("user_id","points");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_key" ON "tags" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "task_statuses_name_key" ON "task_statuses" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "task_statuses_default_key" ON "task_statuses" USING btree ("user_id") WHERE "task_statuses"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "task_types_name_key" ON "task_types" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "time_entries_user_date_idx" ON "time_entries" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE INDEX "time_entries_user_link_idx" ON "time_entries" USING btree ("user_id","link");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_running_key" ON "time_entries" USING btree ("user_id") WHERE "time_entries"."running";--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));
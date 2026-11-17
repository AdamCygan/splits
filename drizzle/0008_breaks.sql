CREATE TABLE "breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"start_time" text,
	"end_time" text,
	"duration_minutes" smallint DEFAULT 0 NOT NULL,
	"running" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"resume_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "breaks_duration" CHECK ("breaks"."duration_minutes" between 0 and 1440
        and ("breaks"."running" or "breaks"."duration_minutes" >= 1))
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "break_minutes" smallint DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_resume_entry_id_time_entries_id_fk" FOREIGN KEY ("resume_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "breaks_user_date" ON "breaks" USING btree ("user_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "breaks_one_running" ON "breaks" USING btree ("user_id") WHERE "breaks"."running";--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_break" CHECK ("user_settings"."break_minutes" between 0 and 240);
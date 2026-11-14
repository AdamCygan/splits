ALTER TABLE "time_entries" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "extension_minutes" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "extension_note" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_estimate" CHECK ("time_entries"."estimate_minutes" is null or "time_entries"."estimate_minutes" between 1 and 60000);--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_extension" CHECK (("time_entries"."extension_minutes" is null and "time_entries"."extension_note" is null)
        or ("time_entries"."extension_minutes" between 1 and "time_entries"."duration_minutes"
          and not "time_entries"."running"
          and char_length("time_entries"."extension_note") between 1 and 1000));
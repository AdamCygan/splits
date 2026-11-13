ALTER TABLE "time_entries" ADD COLUMN "overtime_minutes" integer;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "overtime_note" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_overtime" CHECK (("time_entries"."overtime_minutes" is null and "time_entries"."overtime_note" is null)
        or ("time_entries"."overtime_minutes" between 1 and "time_entries"."duration_minutes"
          and not "time_entries"."running"
          and char_length("time_entries"."overtime_note") between 1 and 1000));
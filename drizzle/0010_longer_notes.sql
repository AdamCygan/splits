ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_limits";--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_limits" CHECK (char_length("time_entries"."title") between 1 and 200
        and ("time_entries"."link" is null or char_length("time_entries"."link") <= 2048)
        and ("time_entries"."note" is null or char_length("time_entries"."note") <= 20000)
        and "time_entries"."duration_minutes" between 0 and 1440);
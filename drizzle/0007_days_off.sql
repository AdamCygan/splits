CREATE TABLE "days_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "days_off_kind" CHECK ("days_off"."kind" in ('vacation', 'sick', 'holiday', 'other')),
	CONSTRAINT "days_off_note" CHECK ("days_off"."note" is null or char_length("days_off"."note") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "days_off" ADD CONSTRAINT "days_off_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "days_off_user_date" ON "days_off" USING btree ("user_id","date");
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"page" text,
	"user_agent" text,
	"status" text DEFAULT 'new' NOT NULL,
	"reply" text,
	"note" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_kind" CHECK ("feedback"."kind" in ('bug', 'idea', 'question')),
	CONSTRAINT "feedback_status" CHECK ("feedback"."status" in ('new', 'in_progress', 'done', 'dismissed')),
	CONSTRAINT "feedback_message" CHECK (char_length("feedback"."message") between 5 and 4000),
	CONSTRAINT "feedback_reply" CHECK ("feedback"."reply" is null or char_length("feedback"."reply") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_created_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id","created_at");
ALTER TYPE "public"."auth_token_purpose" ADD VALUE 'email_change';--> statement-breakpoint
ALTER TYPE "public"."auth_token_purpose" ADD VALUE 'account_deletion';--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "new_email" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "reminder_sent_on" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
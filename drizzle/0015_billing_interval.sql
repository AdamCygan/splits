ALTER TABLE "subscriptions" ADD COLUMN "billing_interval" text;--> statement-breakpoint
-- Dotychczas była tylko płatność roczna.
UPDATE "subscriptions" SET "billing_interval" = 'year' WHERE "billing_interval" IS NULL;

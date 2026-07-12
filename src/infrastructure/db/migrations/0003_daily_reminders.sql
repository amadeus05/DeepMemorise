ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "reminders_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "remind_at" text NOT NULL DEFAULT '18:00';
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'Europe/Moscow';
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "last_daily_reminder_on" text;

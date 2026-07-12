ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "short_reminders_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "quiet_hours_start" text NOT NULL DEFAULT '23:00';
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "quiet_hours_end" text NOT NULL DEFAULT '08:00';
--> statement-breakpoint
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "last_short_reminder_at" timestamptz;

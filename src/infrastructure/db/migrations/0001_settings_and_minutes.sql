CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" uuid PRIMARY KEY,
  "methodology" text DEFAULT 'sm2' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'review_cards' AND column_name = 'interval_days'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'review_cards' AND column_name = 'interval_minutes'
  ) THEN
    ALTER TABLE "review_cards" RENAME COLUMN "interval_days" TO "interval_minutes";
    UPDATE "review_cards" SET "interval_minutes" = "interval_minutes" * 1440;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_settings"
      ADD CONSTRAINT "user_settings_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

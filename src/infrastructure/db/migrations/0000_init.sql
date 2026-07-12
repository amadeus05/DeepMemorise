CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "telegram_id" bigint NOT NULL,
  "username" text,
  "first_name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_uidx" ON "users" ("telegram_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "words" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "term" text NOT NULL,
  "translation" text NOT NULL,
  "example" text,
  "source" text DEFAULT 'manual' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "words_user_term_uidx" ON "words" ("user_id", "term");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "word_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "due_at" timestamptz NOT NULL,
  "interval_minutes" integer DEFAULT 0 NOT NULL,
  "ease_factor" double precision DEFAULT 2.5 NOT NULL,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "lapses" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "review_cards" ADD CONSTRAINT "review_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

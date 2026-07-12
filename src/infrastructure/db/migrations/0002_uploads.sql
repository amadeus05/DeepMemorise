CREATE TABLE IF NOT EXISTS "uploads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_type" text NOT NULL,
  "owner_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "role" text,
  "file_id" text NOT NULL,
  "file_unique_id" text,
  "width" integer,
  "height" integer,
  "file_size" integer,
  "uploaded_by" bigint NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_owner_idx"
  ON "uploads" ("owner_type", "owner_id", "position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "uploads_owner_role_idx"
  ON "uploads" ("owner_type", "owner_id", "role");

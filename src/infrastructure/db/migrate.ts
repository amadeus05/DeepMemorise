import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

export async function applySqlMigrations(pool: Pool): Promise<void> {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const file of files) {
      const id = file.replace(/\.sql$/, "");
      const applied = await client.query<{ id: string }>(
        "SELECT id FROM app_migrations WHERE id = $1",
        [id],
      );
      if ((applied.rowCount ?? 0) > 0) {
        continue;
      }

      const raw = await readFile(path.join(dir, file), "utf8");
      const statements = raw
        .split("--> statement-breakpoint")
        .map((part) => part.trim())
        .filter(Boolean);

      await client.query("BEGIN");
      try {
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query("INSERT INTO app_migrations (id) VALUES ($1)", [id]);
        await client.query("COMMIT");
        console.log(`Migration applied: ${id}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

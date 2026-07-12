import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import { env } from "../src/config/env.js";
import { createDb, warmUpPool } from "../src/infrastructure/db/client.js";
import { applySqlMigrations } from "../src/infrastructure/db/migrate.js";

const { db, pool } = createDb(env.databaseUrl, env.dbCaCert);
await applySqlMigrations(pool);

const indexes = await db.execute(
  sql`select indexname from pg_indexes where tablename = 'review_cards'`,
);
console.log("review_cards indexes:", indexes.rows.map((r) => (r as { indexname: string }).indexname));

const t0 = performance.now();
await warmUpPool(pool);
console.log(`warm-up: ${(performance.now() - t0).toFixed(0)} ms`);

async function measure(label: string, fn: () => Promise<unknown>): Promise<void> {
  const start = performance.now();
  await fn();
  console.log(`${label}: ${(performance.now() - start).toFixed(0)} ms`);
}

// /start DB sequence: upsert user, then 3 queries in parallel
await measure("/start db sequence", async () => {
  await db.execute(sql`select 1`); // stands in for the upsert round-trip
  await Promise.all([
    db.execute(sql`select count(*) from words`),
    db.execute(sql`select count(*) from review_cards where due_at <= now()`),
    db.execute(sql`select * from user_settings limit 1`),
  ]);
});

// grade button DB sequence after optimization: (findById ∥ settings) → update → (findDue ∥ countDue)
await measure("grade db sequence", async () => {
  await Promise.all([
    db.execute(sql`select * from review_cards limit 1`),
    db.execute(sql`select * from user_settings limit 1`),
  ]);
  await db.execute(sql`select 1`); // stands in for the update round-trip
  await Promise.all([
    db.execute(sql`select * from review_cards where due_at <= now() limit 1`),
    db.execute(sql`select count(*) from review_cards where due_at <= now()`),
  ]);
});

await pool.end();

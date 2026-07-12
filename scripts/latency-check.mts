import { performance } from "node:perf_hooks";
import { env } from "../src/config/env.js";
import { createDb } from "../src/infrastructure/db/client.js";

const t0 = performance.now();
const { pool } = createDb(env.databaseUrl, env.dbCaCert);

// Cold connect: TCP + TLS + PG auth
const client = await pool.connect();
const tConnect = performance.now();
console.log(`connect (TCP+TLS+auth): ${(tConnect - t0).toFixed(0)} ms`);

// Warm queries over the established connection
for (let i = 1; i <= 5; i++) {
  const q0 = performance.now();
  await client.query("select 1");
  console.log(`query #${i}: ${(performance.now() - q0).toFixed(0)} ms`);
}
client.release();

// Telegram API round-trip for comparison
const tg0 = performance.now();
const res = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/getMe`);
await res.json();
console.log(`telegram getMe: ${(performance.now() - tg0).toFixed(0)} ms`);

await pool.end();

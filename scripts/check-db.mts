import { sql } from "drizzle-orm";
import { env } from "../src/config/env.js";
import { createDb } from "../src/infrastructure/db/client.js";

const masked = env.databaseUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
console.log("URL=", masked);
console.log("CA=", env.dbCaCert);

try {
  const { db, pool } = createDb(env.databaseUrl, env.dbCaCert);

  const info = await db.execute(
    sql`select current_database() as db, current_user as usr, version() as version`,
  );
  const row = info.rows[0] as { db: string; usr: string; version: string };

  const ssl = await db.execute(
    sql`select ssl, version as tls from pg_stat_ssl where pid = pg_backend_pid()`,
  );
  const sslRow = ssl.rows[0] as { ssl: boolean; tls: string };

  console.log("STATUS=OK");
  console.log("DB=", row.db);
  console.log("USER=", row.usr);
  console.log("VERSION=", row.version.split(",")[0]);
  console.log("SSL=", sslRow.ssl, sslRow.tls);

  await pool.end();
  process.exit(0);
} catch (error) {
  const err = error as { code?: string; message?: string };
  console.log("STATUS=FAIL");
  console.log("CODE=", err.code ?? "n/a");
  console.log("MESSAGE=", err.message ?? String(error));
  process.exit(1);
}

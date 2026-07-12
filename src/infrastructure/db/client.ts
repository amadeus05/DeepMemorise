import fs from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];

export function createDb(connectionString: string, caCertPath: string) {
  if (!fs.existsSync(caCertPath)) {
    throw new Error(
      `CA certificate not found at "${caCertPath}". ` +
        "Download ca.pem from the Aiven console (service overview -> CA certificate) " +
        "or set DB_CA_CERT to its location.",
    );
  }

  // pg gives ssl params parsed from the URL priority over the ssl option,
  // which would drop our CA — so ssl is configured here exclusively.
  const url = new URL(connectionString);
  for (const param of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl"]) {
    url.searchParams.delete(param);
  }

  const pool = new pg.Pool({
    connectionString: url.toString(),
    // TCP+TLS+auth to Aiven costs ~370ms, so keep connections warm:
    // never reap below `min`, keepalive so NAT doesn't drop quiet sessions.
    min: WARM_CONNECTIONS,
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caCertPath, "utf8"),
    },
  });

  // Without a listener, an error on an idle connection crashes the process.
  pool.on("error", (error) => {
    console.error("Idle DB connection error:", error.message);
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

const WARM_CONNECTIONS = 3;

// `min` only prevents reaping — it does not pre-open connections.
export async function warmUpPool(pool: pg.Pool): Promise<void> {
  const clients = await Promise.all(
    Array.from({ length: WARM_CONNECTIONS }, () => pool.connect()),
  );
  for (const client of clients) {
    client.release();
  }
}

import "dotenv/config";
import fs from "node:fs";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Missing env variable: DATABASE_URL");
}

const caCertPath = process.env.DB_CA_CERT ?? "certs/ca.pem";

export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./src/infrastructure/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(caCertPath, "utf8"),
    },
  },
});

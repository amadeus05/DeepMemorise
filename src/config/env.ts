import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
}

export const env = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),
  dbCaCert: process.env.DB_CA_CERT ?? "certs/ca.pem",
};

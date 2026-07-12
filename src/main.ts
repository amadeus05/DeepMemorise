import http from "node:http";
import { env } from "./config/env.js";
import { createDb, warmUpPool } from "./infrastructure/db/client.js";
import { applySqlMigrations } from "./infrastructure/db/migrate.js";
import { UserRepository } from "./infrastructure/db/repositories/UserRepository.js";
import { WordRepository } from "./infrastructure/db/repositories/WordRepository.js";
import { ReviewRepository } from "./infrastructure/db/repositories/ReviewRepository.js";
import { SettingsRepository } from "./infrastructure/db/repositories/SettingsRepository.js";
import { UploadRepository } from "./infrastructure/db/repositories/UploadRepository.js";
import { SystemClock } from "./infrastructure/SystemClock.js";
import { SchedulerRegistry } from "./application/scheduling/SchedulerRegistry.js";
import { SettingsService } from "./application/SettingsService.js";
import { UploadService } from "./application/UploadService.js";
import { WordService } from "./application/WordService.js";
import { ReviewService } from "./application/ReviewService.js";
import { DailyReminderService } from "./application/reminders/DailyReminderService.js";
import { ShortReminderService } from "./application/reminders/ShortReminderService.js";
import { startReminderWorker } from "./infrastructure/reminders/reminderWorker.js";
import { createBot } from "./infrastructure/telegram/bot.js";

// Render (и любой PaaS) требует, чтобы веб-сервис слушал порт из $PORT, иначе
// деплой считается упавшим. Бот работает на long polling и сам HTTP не принимает,
// поэтому поднимаем минимальный сервер: он держит порт и отдаёт /health для
// UptimeRobot (HEAD/GET), чтобы бесплатный инстанс не засыпал.
function startHealthServer(): http.Server {
  const port = Number(process.env.PORT ?? 8000);
  const startedAt = Date.now();

  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(
        JSON.stringify({
          status: "ok",
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });

  server.listen(port, () => {
    console.log(`Health server listening on :${port} (GET/HEAD /health)`);
  });
  return server;
}

async function bootstrap(): Promise<void> {
  // Порт биндим первым делом, до подключения к БД — чтобы Render сразу
  // засёк открытый порт и не свалил деплой по таймауту.
  const healthServer = startHealthServer();

  const { db, pool } = createDb(env.databaseUrl, env.dbCaCert);
  await applySqlMigrations(pool);
  await warmUpPool(pool);

  const clock = new SystemClock();
  const schedulers = new SchedulerRegistry();
  const users = new UserRepository(db);
  const wordRepo = new WordRepository(db);
  const reviewRepo = new ReviewRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const uploadRepo = new UploadRepository(db);
  const settings = new SettingsService(settingsRepo, schedulers);
  const uploads = new UploadService(uploadRepo);
  const words = new WordService(wordRepo, settings, uploads, clock);
  const reviews = new ReviewService(reviewRepo, settings, clock);

  const bot = await createBot(env.telegramBotToken, {
    users,
    words,
    reviews,
    settings,
    uploads,
  });

  const dailyReminders = new DailyReminderService(settings, reviews, clock, bot.api);
  const shortReminders = new ShortReminderService(settings, reviews, clock, bot.api);
  const reminderTimer = startReminderWorker(dailyReminders, shortReminders);

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    clearInterval(reminderTimer);
    healthServer.close();
    void bot
      .stop()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  console.log("Deep Memorise bot is starting...");
  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} is running`);
    },
  });
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

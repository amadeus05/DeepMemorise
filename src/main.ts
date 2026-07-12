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

async function bootstrap(): Promise<void> {
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

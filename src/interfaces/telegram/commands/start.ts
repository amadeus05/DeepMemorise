import type { Bot } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import { methodologyLabel } from "../../../domain/enums/Methodology.js";
import { AppError } from "../../../shared/errors/AppError.js";

export function registerStartCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    const user = await services.users.upsertFromTelegram({
      telegramId: from.id,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
    });

    const [wordsCount, dueCount, settings] = await Promise.all([
      services.words.countWords(user.id),
      services.reviews.countDue(user.id),
      services.settings.getOrCreate(user.id),
    ]);

    await ctx.reply(
      [
        "Deep Memorise — короткие повторения, чтобы слова реально оставались в памяти.",
        "",
        `В словаре: ${wordsCount}`,
        `К повторению: ${dueCount}`,
        `Методика: ${methodologyLabel(settings.methodology)}`,
        "",
        "Команды:",
        "/add — добавить слово",
        "/import — импорт списка из CSV",
        "/words — словарь (просмотр / правка / удаление)",
        "/train — тренировка",
        "/settings — методика повторов",
        "/stats — статистика",
        "/cancel — отменить текущий шаг",
      ].join("\n"),
    );
  });
}

export function registerStatsCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("stats", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    const [wordsCount, dueCount] = await Promise.all([
      services.words.countWords(user.id),
      services.reviews.countDue(user.id),
    ]);

    await ctx.reply(`Слов в словаре: ${wordsCount}\nК повторению сейчас: ${dueCount}`);
  });
}

export async function ensureUser(ctx: BotContext, services: AppServices) {
  const from = ctx.from;
  if (!from) {
    await ctx.reply("Не удалось определить пользователя.");
    return null;
  }

  return services.users.upsertFromTelegram({
    telegramId: from.id,
    username: from.username ?? null,
    firstName: from.first_name ?? null,
  });
}

export function formatAppError(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  console.error(error);
  return "Что-то пошло не так. Попробуй ещё раз.";
}

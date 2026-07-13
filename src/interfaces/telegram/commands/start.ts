import type { Bot } from "grammy";
import type {
  AppServices,
  BotContext,
  SessionUser,
} from "../../../infrastructure/telegram/context.js";
import { SessionCache } from "../../../infrastructure/telegram/sessionCache.js";
import { methodologyLabel } from "../../../domain/enums/Methodology.js";
import { AppError } from "../../../shared/errors/AppError.js";

export function registerStartCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("start", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

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

export async function ensureUser(
  ctx: BotContext,
  services: AppServices,
): Promise<SessionUser | null> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply("Не удалось определить пользователя.");
    return null;
  }

  const username = from.username ?? null;
  const firstName = from.first_name ?? null;

  const cache = new SessionCache(ctx.session);

  // Кеш-хит: тот же пользователь, username/имя не менялись — в базу не ходим.
  const cached = cache.getUser(from.id, username, firstName);
  if (cached) {
    return cached;
  }

  // Первый раз или сменился username — апсертим (создаст, если новый) и кешируем.
  const user = await services.users.upsertFromTelegram({ telegramId: from.id, username, firstName });
  const sessionUser: SessionUser = {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
  };
  cache.setUser(sessionUser);
  return sessionUser;
}

export function formatAppError(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  console.error(error);
  return "Что-то пошло не так. Попробуй ещё раз.";
}

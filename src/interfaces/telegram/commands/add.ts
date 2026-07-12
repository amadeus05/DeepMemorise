import type { Bot } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import { ensureUser, formatAppError } from "./start.js";

export function registerAddCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("add", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    ctx.session.edit = { step: "idle" };
    ctx.session.photo = { step: "idle" };

    const payload = ctx.match?.trim();
    if (payload) {
      await addFromOneLine(ctx, services, user.id, payload);
      return;
    }

    ctx.session.add = { step: "await_term" };
    await ctx.reply(
      [
        "Добавим слово по шагам.",
        "Сначала пришли само слово (например: resilience).",
        "",
        "Или одной строкой:",
        "`/add resilience | устойчивость | She showed great resilience.`",
        "",
        "/cancel — отмена",
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
  });

  bot.command("cancel", async (ctx) => {
    ctx.session.add = { step: "idle" };
    ctx.session.edit = { step: "idle" };
    ctx.session.photo = { step: "idle" };
    await ctx.reply("Ок, отменил.");
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) {
      await next();
      return;
    }

    const step = ctx.session.add.step;
    if (step === "idle") {
      await next();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    try {
      if (step === "await_term") {
        const term = ctx.message.text.trim();
        if (!term) {
          await ctx.reply("Пришли непустое слово.");
          return;
        }
        ctx.session.add = { step: "await_translation", term };
        await ctx.reply(`Слово: ${term}\nТеперь пришли перевод.`);
        return;
      }

      if (step === "await_translation") {
        const translation = ctx.message.text.trim();
        if (!translation) {
          await ctx.reply("Пришли непустой перевод.");
          return;
        }
        ctx.session.add = {
          step: "await_example",
          term: ctx.session.add.term,
          translation,
        };
        await ctx.reply(
          "Опционально: пример предложения.\nИли отправь `-`, чтобы пропустить.",
        );
        return;
      }

      if (step === "await_example") {
        const raw = ctx.message.text.trim();
        const example = raw === "-" ? null : raw;
        const word = await services.words.addWord(user.id, {
          term: ctx.session.add.term,
          translation: ctx.session.add.translation,
          example,
          source: "manual",
        });
        ctx.session.add = { step: "idle" };
        await ctx.reply(
          [
            "Добавлено:",
            `• ${word.term} — ${word.translation}`,
            word.example ? `• Пример: ${word.example}` : null,
            "",
            "Можно /train или снова /add.",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
    } catch (error) {
      ctx.session.add = { step: "idle" };
      await ctx.reply(formatAppError(error));
    }
  });
}

async function addFromOneLine(
  ctx: BotContext,
  services: AppServices,
  userId: string,
  payload: string,
): Promise<void> {
  const parts = payload.split("|").map((part) => part.trim());
  const term = parts[0];
  const translation = parts[1];
  const example = parts[2] || null;

  if (!term || !translation) {
    await ctx.reply("Формат: `/add слово | перевод | пример`", { parse_mode: "Markdown" });
    return;
  }

  try {
    const word = await services.words.addWord(userId, {
      term,
      translation,
      example,
      source: "manual",
    });
    ctx.session.add = { step: "idle" };
    await ctx.reply(`Добавлено: ${word.term} — ${word.translation}`);
  } catch (error) {
    await ctx.reply(formatAppError(error));
  }
}

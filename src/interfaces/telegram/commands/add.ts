import type { Bot } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import {
  addedKeyboard,
  skipExampleKeyboard,
  ADD_MORE,
  ADD_SKIP_EXAMPLE,
} from "../../../infrastructure/telegram/keyboards/addKeyboard.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { ensureUser, formatAppError } from "./start.js";

const HTML = "HTML" as const;

export function registerAddCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("add", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    const payload = ctx.match?.trim();
    if (payload) {
      ctx.session.edit = { step: "idle" };
      ctx.session.photo = { step: "idle" };
      await addFromOneLine(ctx, services, user.id, payload);
      return;
    }

    await startAddFlow(ctx);
  });

  bot.command("cancel", async (ctx) => {
    ctx.session.add = { step: "idle" };
    ctx.session.edit = { step: "idle" };
    ctx.session.photo = { step: "idle" };
    await ctx.reply("Ок, отменил.");
  });

  // «➕ Ещё слово» — начать добавление заново.
  bot.callbackQuery(ADD_MORE, async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await startAddFlow(ctx);
  });

  // «⏭ Пропустить» на шаге примера — добавить без примера.
  bot.callbackQuery(ADD_SKIP_EXAMPLE, async (ctx) => {
    const state = ctx.session.add;
    if (state.step !== "await_example") {
      await ctx.answerCallbackQuery();
      return;
    }
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await finishAdd(ctx, services, user.id, {
      term: state.term,
      translation: state.translation,
      example: null,
    });
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
          "Опционально: пришли пример предложения — или нажми «Пропустить».",
          { reply_markup: skipExampleKeyboard() },
        );
        return;
      }

      if (step === "await_example") {
        const raw = ctx.message.text.trim();
        await finishAdd(ctx, services, user.id, {
          term: ctx.session.add.term,
          translation: ctx.session.add.translation,
          example: raw === "-" ? null : raw,
        });
      }
    } catch (error) {
      ctx.session.add = { step: "idle" };
      await ctx.reply(formatAppError(error));
    }
  });
}

async function startAddFlow(ctx: BotContext): Promise<void> {
  ctx.session.edit = { step: "idle" };
  ctx.session.photo = { step: "idle" };
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
}

async function finishAdd(
  ctx: BotContext,
  services: AppServices,
  userId: string,
  input: { term: string; translation: string; example: string | null },
): Promise<void> {
  try {
    const word = await services.words.addWord(userId, { ...input, source: "manual" });
    const total = await services.words.countWords(userId);
    ctx.session.add = { step: "idle" };

    const lines = [
      "✅ <b>Слово добавлено в словарь</b>",
      "",
      `📕 <b>${escapeHtml(word.term)}</b> — <i>${escapeHtml(word.translation)}</i>`,
    ];
    if (word.example) {
      lines.push(`💬 <i>${escapeHtml(word.example)}</i>`);
    }
    lines.push("", `<i>Теперь в словаре: ${total}</i>`);

    await ctx.reply(lines.join("\n"), { parse_mode: HTML, reply_markup: addedKeyboard() });
  } catch (error) {
    ctx.session.add = { step: "idle" };
    await ctx.reply(formatAppError(error));
  }
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

  await finishAdd(ctx, services, userId, { term, translation, example });
}

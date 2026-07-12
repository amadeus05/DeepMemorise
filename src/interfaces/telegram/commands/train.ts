import type { Bot } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import {
  parseRevealCallback,
  parseReviewCallback,
  revealKeyboard,
  reviewKeyboard,
  TRAIN_CTA,
} from "../../../infrastructure/telegram/keyboards/reviewKeyboard.js";
import { ensureUser, formatAppError } from "./start.js";
import type { DueReview } from "../../../ports/IReviewRepository.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { capitalizeFirst } from "../../../shared/utils/capitalizeFirst.js";

const HTML = "HTML" as const;

export function registerTrainCommand(bot: Bot<BotContext>, services: AppServices): void {
  bot.command("train", async (ctx) => {
    try {
      await startTraining(ctx, services);
    } catch (error) {
      await ctx.reply(formatAppError(error));
    }
  });

  // Кнопка «🧠 Повторить сейчас» под напоминаниями — запускает то же, что /train.
  bot.callbackQuery(TRAIN_CTA, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await startTraining(ctx, services);
    } catch (error) {
      await ctx.answerCallbackQuery();
      await ctx.reply(formatAppError(error));
    }
  });

  bot.callbackQuery(/^reveal:/, async (ctx) => {
    const cardId = parseRevealCallback(ctx.callbackQuery.data);
    if (!cardId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const [current, methodology] = await Promise.all([
        services.reviews.getDueCard(cardId, user.id),
        services.settings.getMethodology(user.id),
      ]);
      if (!current) {
        await ctx.answerCallbackQuery({ text: "Карточка уже не актуальна" });
        await ctx.editMessageText(
          [
            "<b>⏳ Карточка устарела</b>",
            "",
            "<i>Её уже нет в очереди.</i> Жми /train",
          ].join("\n"),
          { parse_mode: HTML },
        );
        return;
      }

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(formatReveal(current), {
        parse_mode: HTML,
        reply_markup: reviewKeyboard(current.card.id, methodology),
      });
    } catch (error) {
      await ctx.answerCallbackQuery();
      await ctx.reply(formatAppError(error));
    }
  });

  bot.callbackQuery(/^review:/, async (ctx) => {
    const parsed = parseReviewCallback(ctx.callbackQuery.data);
    if (!parsed) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const result = await services.reviews.grade(parsed.cardId, user.id, parsed.grade);
      await ctx.answerCallbackQuery({ text: "Записал" });

      if (!result.nextDue) {
        await ctx.editMessageText(
          [
            "<b>🎉 Сессия завершена</b>",
            "",
            "<i>Очередь на сейчас пуста.</i>",
            "",
            `⏱ ${escapeHtml(result.nextReviewHint)}`,
          ].join("\n"),
          { parse_mode: HTML },
        );
        return;
      }

      await ctx.editMessageText(
        [
          `✅ ${escapeHtml(result.nextReviewHint)}`,
          "",
          formatPrompt(result.nextDue, result.totalDue),
        ].join("\n"),
        {
          parse_mode: HTML,
          reply_markup: revealKeyboard(result.nextDue.card.id),
        },
      );
    } catch (error) {
      await ctx.answerCallbackQuery();
      await ctx.reply(formatAppError(error));
    }
  });
}

// Общий старт тренировки для команды /train и кнопки под напоминанием.
async function startTraining(ctx: BotContext, services: AppServices): Promise<void> {
  const user = await ensureUser(ctx, services);
  if (!user) {
    return;
  }

  const [due, totalDue] = await Promise.all([
    services.reviews.getDue(user.id, 1),
    services.reviews.countDue(user.id),
  ]);
  const first = due[0];
  if (!first) {
    await ctx.reply(
      [
        "<b>✨ Пока отдыхаем</b>",
        "",
        "<i>Очередь пуста. Добавь слова через</i> /add",
        "<i>или зайди позже — карточки подтянутся сами.</i>",
      ].join("\n"),
      { parse_mode: HTML },
    );
    return;
  }

  await ctx.reply(formatPrompt(first, totalDue), {
    parse_mode: HTML,
    reply_markup: revealKeyboard(first.card.id),
  });
}

function formatPrompt(item: DueReview, totalDue: number): string {
  const term = escapeHtml(capitalizeFirst(item.word.term));
  return [
    `<b>🧠 Повтор</b> · <i>в очереди ${totalDue}</i>`,
    "",
    `✨ <b>${term}</b>`,
    "",
    "<i>Вспомни перевод — потом открой ответ</i>",
  ].join("\n");
}

function formatReveal(item: DueReview): string {
  const term = escapeHtml(capitalizeFirst(item.word.term));
  const translation = escapeHtml(capitalizeFirst(item.word.translation));
  const lines = [
    `✨ <b>${term}</b>`,
    "",
    `🔤 <b>Перевод:</b> <i>${translation}</i>`,
  ];

  if (item.word.example) {
    lines.push(`💬 <b>Пример:</b> <i>${escapeHtml(item.word.example)}</i>`);
  }

  lines.push("", "<b>Как вспомнилось?</b>");
  return lines.join("\n");
}

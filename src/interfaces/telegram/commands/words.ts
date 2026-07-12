import type { Bot } from "grammy";
import { GrammyError } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import type { Word } from "../../../domain/entities/Word.js";
import {
  deleteConfirmKeyboard,
  formatDeleteConfirm,
  formatWordDetail,
  formatWordsPage,
  getWordsPageSize,
  parseWordDeleteCallback,
  parseWordDeleteConfirmCallback,
  parseWordEditCallback,
  parseWordPhotoCallback,
  parseWordViewCallback,
  parseWordsListCallback,
  parseWordsPageCallback,
  wordDetailKeyboard,
  wordsListKeyboard,
} from "../../../infrastructure/telegram/keyboards/wordsKeyboard.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { capitalizeFirst } from "../../../shared/utils/capitalizeFirst.js";
import { ensureUser, formatAppError } from "./start.js";

const HTML = "HTML" as const;

function isMessageNotModified(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.description.includes("message is not modified")
  );
}

export function registerWordsCommand(bot: Bot<BotContext>, services: AppServices): void {
  const showList = async (ctx: BotContext, page: number, editMessage: boolean) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    const result = await services.words.listWords(user.id, page, getWordsPageSize());
    ctx.session.wordsPage = result.page;

    const text = formatWordsPage(result);

    if (editMessage && ctx.callbackQuery) {
      try {
        if (result.total === 0) {
          await ctx.editMessageText(text, { parse_mode: HTML });
        } else {
          await ctx.editMessageText(text, {
            parse_mode: HTML,
            reply_markup: wordsListKeyboard(result),
          });
        }
      } catch (error) {
        if (!isMessageNotModified(error)) {
          throw error;
        }
      }
      return;
    }

    if (result.total === 0) {
      await ctx.reply(text, { parse_mode: HTML });
    } else {
      await ctx.reply(text, {
        parse_mode: HTML,
        reply_markup: wordsListKeyboard(result),
      });
    }
  };

  const showWordCard = async (
    ctx: BotContext,
    word: Word,
    listPage: number,
    mode: "edit" | "reply",
  ) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    const cover = await services.words.getWordCover(word.id, user.id);
    const hasPhoto = Boolean(cover);
    const text = formatWordDetail(word, hasPhoto);
    const keyboard = wordDetailKeyboard(word.id, listPage, hasPhoto);

    if (mode === "edit" && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: HTML, reply_markup: keyboard });
        return;
      } catch (error) {
        if (isMessageNotModified(error)) {
          return;
        }
      }
    }

    await ctx.reply(text, { parse_mode: HTML, reply_markup: keyboard });
  };

  bot.command(["words", "list"], async (ctx) => {
    ctx.session.edit = { step: "idle" };
    ctx.session.photo = { step: "idle" };
    await showList(ctx, 1, false);
  });

  bot.callbackQuery("w:noop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^w:list:\d+$/, async (ctx) => {
    const page = parseWordsListCallback(ctx.callbackQuery.data) ?? 1;
    try {
      await ctx.answerCallbackQuery();
      await showList(ctx, page, true);
    } catch (error) {
      if (!isMessageNotModified(error)) {
        await ctx.reply(formatAppError(error));
      }
    }
  });

  bot.callbackQuery(/^w:p:\d+$/, async (ctx) => {
    const page = parseWordsPageCallback(ctx.callbackQuery.data);
    if (!page) {
      await ctx.answerCallbackQuery();
      return;
    }

    // Без «страж-guard» по session: целевая страница закодирована в кнопке,
    // а повторную перерисовку той же страницы гасит isMessageNotModified.
    // Guard по session залипал при рассинхроне сессии и показанного сообщения.
    try {
      await ctx.answerCallbackQuery();
      await showList(ctx, page, true);
    } catch (error) {
      if (!isMessageNotModified(error)) {
        await ctx.reply(formatAppError(error));
      }
    }
  });

  bot.callbackQuery(/^w:v:/, async (ctx) => {
    const wordId = parseWordViewCallback(ctx.callbackQuery.data);
    if (!wordId) {
      await ctx.answerCallbackQuery({ text: "Не удалось открыть слово" });
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const word = await services.words.getWordForUser(wordId, user.id);
      const listPage = ctx.session.wordsPage || 1;
      await ctx.answerCallbackQuery();
      await showWordCard(ctx, word, listPage, "edit");
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^w:photo:/, async (ctx) => {
    const parsed = parseWordPhotoCallback(ctx.callbackQuery.data);
    if (!parsed) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user || !ctx.from) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const word = await services.words.getWordForUser(parsed.wordId, user.id);
      const listPage = ctx.session.wordsPage || 1;

      if (parsed.action === "add") {
        ctx.session.add = { step: "idle" };
        ctx.session.edit = { step: "idle" };
        ctx.session.photo = {
          step: "await_photo",
          wordId: word.id,
          listPage,
        };
        await ctx.answerCallbackQuery();
        await ctx.reply(
          `📷 Пришли фото для <b>${escapeHtml(capitalizeFirst(word.term))}</b>.\n` +
            `<i>Сохраним только Telegram file_id.</i>\n` +
            "/cancel — отмена",
          { parse_mode: HTML },
        );
        return;
      }

      if (parsed.action === "show") {
        const cover = await services.words.getWordCover(word.id, user.id);
        if (!cover) {
          await ctx.answerCallbackQuery({ text: "Фото нет" });
          return;
        }
        await ctx.answerCallbackQuery();
        await ctx.replyWithPhoto(cover.fileId, {
          caption: `✨ <b>${escapeHtml(capitalizeFirst(word.term))}</b> — <i>${escapeHtml(capitalizeFirst(word.translation))}</i>`,
          parse_mode: HTML,
        });
        return;
      }

      await services.words.removeWordCover(word.id, user.id);
      await ctx.answerCallbackQuery({ text: "Фото удалено" });
      await showWordCard(ctx, word, listPage, "edit");
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^w:e:/, async (ctx) => {
    const parsed = parseWordEditCallback(ctx.callbackQuery.data);
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
      await services.words.getWordForUser(parsed.wordId, user.id);
      ctx.session.add = { step: "idle" };
      ctx.session.photo = { step: "idle" };
      ctx.session.edit = {
        step: "await_value",
        wordId: parsed.wordId,
        field: parsed.field,
        listPage: ctx.session.wordsPage,
      };

      const prompts = {
        term: "Пришли новое написание слова.\n/cancel — отмена",
        translation: "Пришли новый перевод.\n/cancel — отмена",
        example: "Пришли новый пример.\nИли `-`, чтобы очистить.\n/cancel — отмена",
      } as const;

      await ctx.answerCallbackQuery();
      await ctx.reply(prompts[parsed.field]);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error) });
    }
  });

  bot.callbackQuery(/^w:delok:/, async (ctx) => {
    const wordId = parseWordDeleteConfirmCallback(ctx.callbackQuery.data);
    if (!wordId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      await services.words.deleteWord(wordId, user.id);
      await ctx.answerCallbackQuery({ text: "Удалено" });
      await showList(ctx, ctx.session.wordsPage, true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error) });
    }
  });

  bot.callbackQuery(/^w:del:[0-9a-f-]+$/i, async (ctx) => {
    const wordId = parseWordDeleteCallback(ctx.callbackQuery.data);
    if (!wordId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const word = await services.words.getWordForUser(wordId, user.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(formatDeleteConfirm(word), {
        parse_mode: HTML,
        reply_markup: deleteConfirmKeyboard(word.id, ctx.session.wordsPage),
      });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error) });
    }
  });

  bot.on("message:photo", async (ctx, next) => {
    if (ctx.session.photo.step !== "await_photo") {
      await next();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user || !ctx.from) {
      return;
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    if (!best) {
      await ctx.reply("Не удалось прочитать фото. Пришли ещё раз.");
      return;
    }

    const { wordId, listPage } = ctx.session.photo;

    try {
      await services.words.attachWordCover(wordId, user.id, ctx.from.id, {
        fileId: best.file_id,
        fileUniqueId: best.file_unique_id,
        width: best.width,
        height: best.height,
        fileSize: best.file_size ?? null,
      });

      ctx.session.photo = { step: "idle" };
      const word = await services.words.getWordForUser(wordId, user.id);
      await ctx.reply("✅ <b>Фото прикреплено</b>", { parse_mode: HTML });
      await showWordCard(ctx, word, listPage, "reply");
    } catch (error) {
      ctx.session.photo = { step: "idle" };
      await ctx.reply(formatAppError(error));
    }
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) {
      await next();
      return;
    }

    if (ctx.session.edit.step !== "await_value") {
      await next();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    const { wordId, field, listPage } = ctx.session.edit;
    const raw = ctx.message.text.trim();

    try {
      const patch =
        field === "example"
          ? { example: raw === "-" ? null : raw }
          : field === "term"
            ? { term: raw }
            : { translation: raw };

      const word = await services.words.updateWord(wordId, user.id, patch);
      ctx.session.edit = { step: "idle" };
      ctx.session.wordsPage = listPage;

      await showWordCard(ctx, word, listPage, "reply");
    } catch (error) {
      ctx.session.edit = { step: "idle" };
      await ctx.reply(formatAppError(error));
    }
  });
}

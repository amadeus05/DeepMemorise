import type { Bot } from "grammy";
import { GrammyError } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import type { Word } from "../../../domain/entities/Word.js";
import {
  bulkDeleteConfirmKeyboard,
  deleteConfirmKeyboard,
  formatBulkDeleteConfirm,
  formatDeleteConfirm,
  formatWordDetail,
  formatWordsPage,
  formatWordsSelectPage,
  getWordsPageSize,
  parseBulkToggleCallback,
  parseWordDeleteCallback,
  parseWordDeleteConfirmCallback,
  parseWordEditCallback,
  parseWordPhotoCallback,
  parseWordViewCallback,
  parseWordsListCallback,
  parseWordsPageCallback,
  wordDetailKeyboard,
  wordsListKeyboard,
  wordsSelectKeyboard,
} from "../../../infrastructure/telegram/keyboards/wordsKeyboard.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { capitalizeFirst } from "../../../shared/utils/capitalizeFirst.js";
import { SessionCache } from "../../../infrastructure/telegram/sessionCache.js";
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

    const cache = new SessionCache(ctx.session);
    if (result.total === 0) {
      // Пустой словарь — выходим из режима выбора, ему тут нечего показывать.
      ctx.session.bulkDelete = { step: "idle" };
      cache.clearPage();
    } else {
      // Кешируем страницу — toggle перерисует галочки отсюда, без запроса в БД.
      cache.setPage({
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        items: result.items.map((w) => ({ id: w.id, term: w.term, translation: w.translation })),
      });
    }

    const bulk = ctx.session.bulkDelete;
    let text: string;
    let keyboard: ReturnType<typeof wordsListKeyboard> | undefined;

    if (result.total === 0) {
      text = formatWordsPage(result);
      keyboard = undefined;
    } else if (bulk.step === "selecting") {
      text = formatWordsSelectPage(result, bulk.selected.length);
      keyboard = wordsSelectKeyboard(result, new Set(bulk.selected));
    } else {
      text = formatWordsPage(result);
      keyboard = wordsListKeyboard(result);
    }

    if (editMessage && ctx.callbackQuery) {
      try {
        if (keyboard) {
          await ctx.editMessageText(text, { parse_mode: HTML, reply_markup: keyboard });
        } else {
          await ctx.editMessageText(text, { parse_mode: HTML });
        }
      } catch (error) {
        if (!isMessageNotModified(error)) {
          throw error;
        }
      }
      return;
    }

    if (keyboard) {
      await ctx.reply(text, { parse_mode: HTML, reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: HTML });
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
    ctx.session.bulkDelete = { step: "idle" };
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

  // --- Массовое удаление: включить режим выбора ---
  bot.callbackQuery("w:bulk:on", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    ctx.session.bulkDelete = { step: "selecting", selected: [] };
    await ctx.answerCallbackQuery();
    await showList(ctx, ctx.session.wordsPage, true);
  });

  // Выйти из режима выбора без удаления.
  bot.callbackQuery("w:bulk:off", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    ctx.session.bulkDelete = { step: "idle" };
    await ctx.answerCallbackQuery();
    await showList(ctx, ctx.session.wordsPage, true);
  });

  // Тап по слову в режиме выбора — поставить/снять галочку. Выбор хранится
  // в сессии, а не привязан к странице, поэтому переключение страниц его не сбрасывает.
  bot.callbackQuery(/^w:bulk:t:[0-9a-f-]{36}$/i, async (ctx) => {
    const wordId = parseBulkToggleCallback(ctx.callbackQuery.data);
    const state = ctx.session.bulkDelete;
    if (!wordId || state.step !== "selecting") {
      await ctx.answerCallbackQuery();
      return;
    }

    // Тап меняет только выбор в сессии — юзер тут не нужен, в БД не ходим.
    const selected = new Set(state.selected);
    if (selected.has(wordId)) {
      selected.delete(wordId);
    } else {
      selected.add(wordId);
    }
    ctx.session.bulkDelete = { step: "selecting", selected: [...selected] };

    await ctx.answerCallbackQuery();

    // Слова на странице не изменились — перерисовываем галочки из кеша страницы,
    // без повторного запроса списка. Кеша нет только после рестарта бота — тогда фолбэк.
    const cached = new SessionCache(ctx.session).getPage(ctx.session.wordsPage);
    if (!cached) {
      await showList(ctx, ctx.session.wordsPage, true);
      return;
    }

    try {
      await ctx.editMessageText(formatWordsSelectPage(cached, selected.size), {
        parse_mode: HTML,
        reply_markup: wordsSelectKeyboard(cached, selected),
      });
    } catch (error) {
      if (!isMessageNotModified(error)) {
        await ctx.reply(formatAppError(error));
      }
    }
  });

  // «🗑 Удалить (N)» — экран подтверждения со всеми выбранными словами.
  bot.callbackQuery("w:bulk:go", async (ctx) => {
    const state = ctx.session.bulkDelete;
    if (state.step !== "selecting" || state.selected.length === 0) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const words = await services.words.getWordsForUser(state.selected, user.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(formatBulkDeleteConfirm(words), {
        parse_mode: HTML,
        reply_markup: bulkDeleteConfirmKeyboard(words.length),
      });
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  // Вернуться с экрана подтверждения к списку, сохранив выбор.
  bot.callbackQuery("w:bulk:back", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.answerCallbackQuery();
    await showList(ctx, ctx.session.wordsPage, true);
  });

  // Подтверждено — удаляем всё разом.
  bot.callbackQuery("w:bulk:ok", async (ctx) => {
    const state = ctx.session.bulkDelete;
    if (state.step !== "selecting" || state.selected.length === 0) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const deleted = await services.words.deleteWordsBulk(state.selected, user.id);
      ctx.session.bulkDelete = { step: "idle" };
      ctx.session.wordsPage = 1;
      await ctx.answerCallbackQuery({ text: `Удалено: ${deleted}` });
      await showList(ctx, 1, true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
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

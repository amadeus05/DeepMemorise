import type { Bot } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import {
  importCancelKeyboard,
  importDoneKeyboard,
  IMPORT_CANCEL,
} from "../../../infrastructure/telegram/keyboards/importKeyboard.js";
import { escapeHtml } from "../../../shared/utils/telegramHtml.js";
import { ensureUser, formatAppError } from "./start.js";
import type { ImportSummary } from "../../../application/BulkImportService.js";

const HTML = "HTML" as const;
const MAX_FILE_BYTES = 512 * 1024; // с запасом для CSV на пару сотен строк
const MAX_DETAIL_LINES = 10;

export function registerImportCommand(
  bot: Bot<BotContext>,
  services: AppServices,
  botToken: string,
): void {
  bot.command("import", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    ctx.session.add = { step: "idle" };
    ctx.session.edit = { step: "idle" };
    ctx.session.photo = { step: "idle" };
    ctx.session.import = { step: "await_file" };

    await ctx.reply(
      [
        "📥 <b>Массовый импорт слов</b>",
        "",
        "Пришли CSV-файл. В каждой строке: <code>слово,перевод,пример</code>",
        "<i>Пример — необязателен. Первая строка может быть заголовком.</i>",
        "",
        "Максимум 200 слов за раз.",
      ].join("\n"),
      { parse_mode: HTML, reply_markup: importCancelKeyboard() },
    );
  });

  bot.callbackQuery(IMPORT_CANCEL, async (ctx) => {
    ctx.session.import = { step: "idle" };
    await ctx.answerCallbackQuery({ text: "Отменено" });
    await ctx.reply("Ок, отменил.");
  });

  bot.on("message:document", async (ctx, next) => {
    if (ctx.session.import.step !== "await_file") {
      await next();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    ctx.session.import = { step: "idle" };

    const doc = ctx.message.document;
    const fileName = doc.file_name;
    if (!fileName) {
      await ctx.reply(
        "Не удалось определить имя файла. Пришли файл с расширением, например Slova.csv.",
      );
      return;
    }

    if (doc.file_size && doc.file_size > MAX_FILE_BYTES) {
      await ctx.reply(`Файл слишком большой (максимум ${Math.floor(MAX_FILE_BYTES / 1024)} КБ).`);
      return;
    }

    const startedAt = Date.now();
    try {
      const file = await ctx.api.getFile(doc.file_id);
      if (!file.file_path) {
        throw new Error("Telegram did not return a file_path for this document");
      }

      const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
      const downloadStart = Date.now();
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`File download failed with status ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const downloadMs = Date.now() - downloadStart;

      const dbStart = Date.now();
      const summary = await services.bulkImport.importFromFile(user.id, fileName, buffer);
      const dbMs = Date.now() - dbStart;

      const total = summary.added.length + summary.duplicates.length + summary.invalid.length;
      console.log(
        `Import: ${total} rows, ${summary.added.length} added — ` +
          `download ${downloadMs}ms, db ${dbMs}ms (${Math.round(dbMs / Math.max(1, total))}ms/row), ` +
          `total ${Date.now() - startedAt}ms`,
      );

      await ctx.reply(formatImportSummary(summary), {
        parse_mode: HTML,
        ...(summary.added.length > 0 ? { reply_markup: importDoneKeyboard() } : {}),
      });
    } catch (error) {
      await ctx.reply(formatAppError(error));
    }
  });
}

function formatImportSummary(summary: ImportSummary): string {
  const lines = ["📥 <b>Импорт завершён</b>", "", `✅ Добавлено: <b>${summary.added.length}</b>`];

  if (summary.duplicates.length > 0) {
    lines.push(`⏭ Уже были в словаре: <b>${summary.duplicates.length}</b>`);
  }
  if (summary.invalid.length > 0) {
    lines.push(`⚠️ Пропущено с ошибкой: <b>${summary.invalid.length}</b>`);
  }

  const issues = [...summary.duplicates, ...summary.invalid].sort((a, b) => a.row - b.row);
  if (issues.length > 0) {
    lines.push("", "<i>Детали:</i>");
    for (const issue of issues.slice(0, MAX_DETAIL_LINES)) {
      lines.push(`  ${issue.row}. ${escapeHtml(issue.term)} — ${escapeHtml(issue.reason)}`);
    }
    if (issues.length > MAX_DETAIL_LINES) {
      lines.push(`  ...и ещё ${issues.length - MAX_DETAIL_LINES}`);
    }
  }

  return lines.join("\n");
}

import type { Bot } from "grammy";
import { GrammyError } from "grammy";
import type { AppServices, BotContext } from "../../../infrastructure/telegram/context.js";
import {
  methodologyHelp,
  parseMethodologyCallback,
  parseQuietHoursCallback,
  parseRegionCallback,
  parseRemindTimezoneCallback,
  quietHoursKeyboard,
  remindRegionsKeyboard,
  remindZonesKeyboard,
  settingsKeyboard,
} from "../../../infrastructure/telegram/keyboards/settingsKeyboard.js";
import { isMethodology } from "../../../domain/enums/Methodology.js";
import type { UserSettings } from "../../../domain/entities/UserSettings.js";
import { ensureUser, formatAppError } from "./start.js";

const HTML = "HTML" as const;

function isMessageNotModified(error: unknown): boolean {
  return error instanceof GrammyError && error.description.includes("message is not modified");
}

export function registerSettingsCommand(bot: Bot<BotContext>, services: AppServices): void {
  const renderSettings = async (
    ctx: BotContext,
    settings: UserSettings,
    extraLines: string[] = [],
    edit = false,
  ) => {
    const text = [services.settings.formatSettings(settings), ...extraLines]
      .filter(Boolean)
      .join("\n");
    const markup = settingsKeyboard(settings);

    if (edit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: HTML,
          reply_markup: markup,
        });
      } catch (error) {
        if (!isMessageNotModified(error)) {
          throw error;
        }
      }
      return;
    }

    await ctx.reply(text, { parse_mode: HTML, reply_markup: markup });
  };

  bot.command("settings", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      return;
    }

    try {
      const settings = await services.settings.getOrCreate(user.id);
      await renderSettings(ctx, settings);
    } catch (error) {
      await ctx.reply(formatAppError(error));
    }
  });

  bot.callbackQuery("set:back", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.getOrCreate(user.id);
      await ctx.answerCallbackQuery();
      await renderSettings(ctx, settings, [], true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^set:method:/, async (ctx) => {
    const raw = parseMethodologyCallback(ctx.callbackQuery.data);
    if (!raw || !isMethodology(raw)) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.setMethodology(user.id, raw);
      await ctx.answerCallbackQuery({ text: "Методика сохранена" });
      await renderSettings(ctx, settings, ["", methodologyHelp(settings.methodology)], true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery("set:remind:short", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const current = await services.settings.getOrCreate(user.id);
      const settings = await services.settings.setRemindersEnabled(
        user.id,
        !current.shortRemindersEnabled,
      );
      await ctx.answerCallbackQuery({
        text: settings.shortRemindersEnabled ? "Напоминания включены" : "Напоминания выключены",
      });
      await renderSettings(ctx, settings, [], true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery("set:remind:quiet", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.getOrCreate(user.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        [
          "<b>🌙 Не беспокоить</b>",
          "<i>В это время напоминания не приходят.</i>",
        ].join("\n"),
        {
          parse_mode: HTML,
          reply_markup: quietHoursKeyboard(settings.quietHoursStart, settings.quietHoursEnd),
        },
      );
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^set:remind:qh:/, async (ctx) => {
    const parsed = parseQuietHoursCallback(ctx.callbackQuery.data);
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
      const settings = await services.settings.setQuietHours(
        user.id,
        parsed.start,
        parsed.end,
      );
      await ctx.answerCallbackQuery({ text: `Тихие: ${parsed.start}–${parsed.end}` });
      await renderSettings(ctx, settings, [], true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery("set:remind:zones", async (ctx) => {
    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.getOrCreate(user.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "<b>🌍 Часовой пояс</b>\n<i>Сначала выбери регион</i>",
        {
          parse_mode: HTML,
          reply_markup: remindRegionsKeyboard(settings.timezone),
        },
      );
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^set:remind:zreg:/, async (ctx) => {
    const region = parseRegionCallback(ctx.callbackQuery.data);
    if (!region) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.getOrCreate(user.id);
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "<b>🌍 Часовой пояс</b>\n<i>Выбери город с твоим временем</i>",
        {
          parse_mode: HTML,
          reply_markup: remindZonesKeyboard(region, settings.timezone, (tz) =>
            services.settings.timezoneButtonLabel(tz),
          ),
        },
      );
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });

  bot.callbackQuery(/^set:remind:tz:/, async (ctx) => {
    const timezone = parseRemindTimezoneCallback(ctx.callbackQuery.data);
    if (!timezone) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await ensureUser(ctx, services);
    if (!user) {
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const settings = await services.settings.setTimezone(user.id, timezone);
      await ctx.answerCallbackQuery({ text: "Часовой пояс сохранён" });
      await renderSettings(ctx, settings, [], true);
    } catch (error) {
      await ctx.answerCallbackQuery({ text: formatAppError(error).slice(0, 180) });
    }
  });
}

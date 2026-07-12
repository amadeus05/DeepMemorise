import type { Api } from "grammy";
import type { IClock } from "../../ports/IClock.js";
import type { SettingsService } from "../SettingsService.js";
import type { ReviewService } from "../ReviewService.js";
import {
  getZonedClock,
  shouldSendDailyReminder,
} from "./dailyReminderLogic.js";
import { trainCtaKeyboard } from "../../infrastructure/telegram/keyboards/reviewKeyboard.js";

/**
 * Дневной якорь: раз в локальный день после remindAt, только если due > 0.
 * Инвариант: никогда не меняет dueAt.
 */
export class DailyReminderService {
  public constructor(
    private readonly settings: SettingsService,
    private readonly reviews: ReviewService,
    private readonly clock: IClock,
    private readonly api: Api,
  ) {}

  public async tick(): Promise<void> {
    const now = this.clock.now();
    const candidates = await this.settings.listReminderCandidates();

    for (const candidate of candidates) {
      const { settings, telegramId } = candidate;
      try {
        if (
          !shouldSendDailyReminder({
            now,
            timezone: settings.timezone,
            remindAt: settings.remindAt,
            lastDailyReminderOn: settings.lastDailyReminderOn,
          })
        ) {
          continue;
        }

        const localDate = getZonedClock(now, settings.timezone).date;

        const dueCount = await this.reviews.countDue(settings.userId);
        if (dueCount > 0) {
          await this.api.sendMessage(
            telegramId,
            [
              "<b>🔔 Время повторить слова</b>",
              "",
              `К повторению: <b>${dueCount}</b>`,
              "",
              "<i>Короткая сессия — жми кнопку ниже 👇</i>",
            ].join("\n"),
            { parse_mode: "HTML", reply_markup: trainCtaKeyboard() },
          );
        }
        await this.settings.markDailyReminderSent(settings.userId, localDate);
      } catch (error) {
        console.error(`Daily reminder failed for user ${settings.userId}:`, error);
      }
    }
  }
}

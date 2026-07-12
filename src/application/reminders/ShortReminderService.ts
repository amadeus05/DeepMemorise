import type { Api } from "grammy";
import type { IClock } from "../../ports/IClock.js";
import type { SettingsService } from "../SettingsService.js";
import type { ReviewService } from "../ReviewService.js";
import { getZonedClock } from "./dailyReminderLogic.js";
import { shouldSendShortReminder, shortReminderCooldownMs } from "./shortReminderLogic.js";
import { trainCtaKeyboard } from "../../infrastructure/telegram/keyboards/reviewKeyboard.js";

/**
 * Короткие пуши, когда уже есть due (интервалы 10–30 мин и т.п.).
 * Антиспам: cooldown 10 мин (Эббингауз) / 25 мин (SM-2). Тихие часы. dueAt не меняет.
 */
export class ShortReminderService {
  public constructor(
    private readonly settings: SettingsService,
    private readonly reviews: ReviewService,
    private readonly clock: IClock,
    private readonly api: Api,
  ) {}

  public async tick(): Promise<void> {
    const now = this.clock.now();
    const candidates = await this.settings.listShortReminderCandidates();

    for (const candidate of candidates) {
      const { settings, telegramId } = candidate;
      try {
        const localTime = getZonedClock(now, settings.timezone).time;

        const dueCount = await this.reviews.countDue(settings.userId);
        if (
          !shouldSendShortReminder({
            dueCount,
            now,
            localTime,
            quietHoursStart: settings.quietHoursStart,
            quietHoursEnd: settings.quietHoursEnd,
            lastShortReminderAt: settings.lastShortReminderAt,
            cooldownMs: shortReminderCooldownMs(settings.methodology),
          })
        ) {
          continue;
        }

        await this.api.sendMessage(
          telegramId,
          [
            "<b>⚡ Пора короткий повтор</b>",
            "",
            `К повторению: <b>${dueCount}</b>`,
            "",
            "<i>Пара минут — жми кнопку ниже 👇</i>",
          ].join("\n"),
          { parse_mode: "HTML", reply_markup: trainCtaKeyboard() },
        );

        await this.settings.markShortReminderSent(settings.userId, now);
      } catch (error) {
        console.error(`Short reminder failed for user ${settings.userId}:`, error);
      }
    }
  }
}

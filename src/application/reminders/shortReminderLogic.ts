import { compareHhMm, isValidRemindAt } from "./timeUtils.js";
import { Methodology } from "../../domain/enums/Methodology.js";

export const SHORT_REMINDER_COOLDOWN_MS = 25 * 60_000; // SM-2: интервалы в днях
export const SHORT_REMINDER_COOLDOWN_FAST_MS = 10 * 60_000; // Эббингауз: шаги 10–30 мин

// У Эббингауза ранние шаги короткие (10–30 мин), поэтому и пуши уместны чаще.
// У SM-2 всё в днях — там 25 мин анти-спама достаточно.
export function shortReminderCooldownMs(methodology: Methodology): number {
  return methodology === Methodology.Ebbinghaus
    ? SHORT_REMINDER_COOLDOWN_FAST_MS
    : SHORT_REMINDER_COOLDOWN_MS;
}

/**
 * Тихие часы. Поддержка перехода через полночь (23:00–08:00).
 */
export function isInQuietHours(
  localTime: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  if (!isValidRemindAt(localTime) || !isValidRemindAt(quietStart) || !isValidRemindAt(quietEnd)) {
    return false;
  }

  if (quietStart === quietEnd) {
    return false;
  }

  if (compareHhMm(quietStart, quietEnd) < 0) {
    return compareHhMm(localTime, quietStart) >= 0 && compareHhMm(localTime, quietEnd) < 0;
  }

  return compareHhMm(localTime, quietStart) >= 0 || compareHhMm(localTime, quietEnd) < 0;
}

export function shouldSendShortReminder(input: {
  dueCount: number;
  now: Date;
  localTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  lastShortReminderAt: Date | null;
  cooldownMs?: number;
}): boolean {
  if (input.dueCount <= 0) {
    return false;
  }

  if (isInQuietHours(input.localTime, input.quietHoursStart, input.quietHoursEnd)) {
    return false;
  }

  const cooldown = input.cooldownMs ?? SHORT_REMINDER_COOLDOWN_MS;
  if (input.lastShortReminderAt) {
    const elapsed = input.now.getTime() - input.lastShortReminderAt.getTime();
    if (elapsed < cooldown) {
      return false;
    }
  }

  return true;
}

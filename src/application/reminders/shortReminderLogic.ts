import { compareHhMm, isValidRemindAt } from "./dailyReminderLogic.js";

export const SHORT_REMINDER_COOLDOWN_MS = 25 * 60_000;

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

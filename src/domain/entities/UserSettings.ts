import type { Methodology } from "../enums/Methodology.js";
import { Methodology as MethodologyEnum } from "../enums/Methodology.js";

export class UserSettings {
  public constructor(
    public readonly userId: string,
    public readonly methodology: Methodology,
    public readonly remindersEnabled: boolean,
    public readonly remindAt: string,
    public readonly timezone: string,
    public readonly lastDailyReminderOn: string | null,
    public readonly shortRemindersEnabled: boolean,
    public readonly quietHoursStart: string,
    public readonly quietHoursEnd: string,
    public readonly lastShortReminderAt: Date | null,
    public readonly updatedAt: Date,
  ) {}

  public static defaults(userId: string): UserSettings {
    return new UserSettings(
      userId,
      MethodologyEnum.Sm2,
      false,
      "18:00",
      "Europe/Moscow",
      null,
      false,
      "23:00",
      "08:00",
      null,
      new Date(),
    );
  }
}

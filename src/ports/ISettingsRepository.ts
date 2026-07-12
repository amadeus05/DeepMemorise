import type { Methodology } from "../domain/enums/Methodology.js";
import type { UserSettings } from "../domain/entities/UserSettings.js";

export type ReminderCandidate = {
  settings: UserSettings;
  telegramId: number;
};

export type UpdateReminderSettingsInput = {
  remindersEnabled?: boolean;
  remindAt?: string;
  timezone?: string;
  lastDailyReminderOn?: string | null;
  shortRemindersEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  lastShortReminderAt?: Date | null;
};

export interface ISettingsRepository {
  getByUserId(userId: string): Promise<UserSettings | null>;
  upsertMethodology(userId: string, methodology: Methodology): Promise<UserSettings>;
  updateReminders(userId: string, input: UpdateReminderSettingsInput): Promise<UserSettings>;
  listShortReminderCandidates(): Promise<ReminderCandidate[]>;
}

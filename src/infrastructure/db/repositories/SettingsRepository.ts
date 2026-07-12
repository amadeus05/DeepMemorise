import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { userSettings, users } from "../schema.js";
import { UserSettings } from "../../../domain/entities/UserSettings.js";
import {
  isMethodology,
  type Methodology,
} from "../../../domain/enums/Methodology.js";
import type {
  ISettingsRepository,
  ReminderCandidate,
  UpdateReminderSettingsInput,
} from "../../../ports/ISettingsRepository.js";

export class SettingsRepository implements ISettingsRepository {
  public constructor(private readonly db: Database) {}

  public async getByUserId(userId: string): Promise<UserSettings | null> {
    const [row] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return row ? this.map(row) : null;
  }

  public async upsertMethodology(userId: string, methodology: Methodology): Promise<UserSettings> {
    const [row] = await this.db
      .insert(userSettings)
      .values({
        userId,
        methodology,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          methodology,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error("Failed to upsert user settings");
    }

    return this.map(row);
  }

  public async updateReminders(
    userId: string,
    input: UpdateReminderSettingsInput,
  ): Promise<UserSettings> {
    const existing = await this.getByUserId(userId);
    if (!existing) {
      const [created] = await this.db
        .insert(userSettings)
        .values({
          userId,
          methodology: "sm2",
          remindersEnabled: input.remindersEnabled ?? false,
          remindAt: input.remindAt ?? "18:00",
          timezone: input.timezone ?? "Europe/Moscow",
          lastDailyReminderOn: input.lastDailyReminderOn ?? null,
          shortRemindersEnabled: input.shortRemindersEnabled ?? false,
          quietHoursStart: input.quietHoursStart ?? "23:00",
          quietHoursEnd: input.quietHoursEnd ?? "08:00",
          lastShortReminderAt: input.lastShortReminderAt ?? null,
          updatedAt: new Date(),
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create user settings");
      }
      return this.map(created);
    }

    const [row] = await this.db
      .update(userSettings)
      .set({
        ...(input.remindersEnabled !== undefined
          ? { remindersEnabled: input.remindersEnabled }
          : {}),
        ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.lastDailyReminderOn !== undefined
          ? { lastDailyReminderOn: input.lastDailyReminderOn }
          : {}),
        ...(input.shortRemindersEnabled !== undefined
          ? { shortRemindersEnabled: input.shortRemindersEnabled }
          : {}),
        ...(input.quietHoursStart !== undefined
          ? { quietHoursStart: input.quietHoursStart }
          : {}),
        ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd } : {}),
        ...(input.lastShortReminderAt !== undefined
          ? { lastShortReminderAt: input.lastShortReminderAt }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning();

    if (!row) {
      throw new Error("Failed to update reminder settings");
    }

    return this.map(row);
  }

  public async listReminderCandidates(): Promise<ReminderCandidate[]> {
    const rows = await this.db
      .select({
        settings: userSettings,
        telegramId: users.telegramId,
      })
      .from(userSettings)
      .innerJoin(users, eq(users.id, userSettings.userId))
      .where(eq(userSettings.remindersEnabled, true));

    return rows.map((row) => ({
      settings: this.map(row.settings),
      telegramId: row.telegramId,
    }));
  }

  public async listShortReminderCandidates(): Promise<ReminderCandidate[]> {
    const rows = await this.db
      .select({
        settings: userSettings,
        telegramId: users.telegramId,
      })
      .from(userSettings)
      .innerJoin(users, eq(users.id, userSettings.userId))
      .where(eq(userSettings.shortRemindersEnabled, true));

    return rows.map((row) => ({
      settings: this.map(row.settings),
      telegramId: row.telegramId,
    }));
  }

  private map(row: typeof userSettings.$inferSelect): UserSettings {
    const methodology = isMethodology(row.methodology) ? row.methodology : "sm2";
    return new UserSettings(
      row.userId,
      methodology,
      row.remindersEnabled,
      row.remindAt,
      row.timezone,
      row.lastDailyReminderOn,
      row.shortRemindersEnabled,
      row.quietHoursStart,
      row.quietHoursEnd,
      row.lastShortReminderAt,
      row.updatedAt,
    );
  }
}

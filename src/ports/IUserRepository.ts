import type { User } from "../domain/entities/User.js";

export type UpsertTelegramUserInput = {
  telegramId: number;
  username: string | null;
  firstName: string | null;
};

export interface IUserRepository {
  upsertFromTelegram(input: UpsertTelegramUserInput): Promise<User>;
  findByTelegramId(telegramId: number): Promise<User | null>;
}

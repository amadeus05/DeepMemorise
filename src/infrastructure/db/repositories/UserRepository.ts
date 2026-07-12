import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { users } from "../schema.js";
import { User } from "../../../domain/entities/User.js";
import type {
  IUserRepository,
  UpsertTelegramUserInput,
} from "../../../ports/IUserRepository.js";

export class UserRepository implements IUserRepository {
  public constructor(private readonly db: Database) {}

  public async upsertFromTelegram(input: UpsertTelegramUserInput): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        telegramId: input.telegramId,
        username: input.username,
        firstName: input.firstName,
      })
      .onConflictDoUpdate({
        target: users.telegramId,
        set: {
          username: input.username,
          firstName: input.firstName,
        },
      })
      .returning();

    if (!row) {
      throw new Error("Failed to upsert user");
    }

    return this.map(row);
  }

  public async findByTelegramId(telegramId: number): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return row ? this.map(row) : null;
  }

  private map(row: typeof users.$inferSelect): User {
    return new User(row.id, row.telegramId, row.username, row.firstName, row.createdAt);
  }
}

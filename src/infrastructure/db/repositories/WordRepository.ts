import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { reviewCards, words } from "../schema.js";
import { Word, type WordSource } from "../../../domain/entities/Word.js";
import type { AddWordInput } from "../../../domain/types/AddWordInput.js";
import type {
  IWordRepository,
  NewReviewCardState,
  UpdateWordInput,
  WordPage,
} from "../../../ports/IWordRepository.js";
import { AppError } from "../../../shared/errors/AppError.js";

const PG_UNIQUE_VIOLATION = "23505";

// Drizzle оборачивает pg-ошибку в DrizzleQueryError, а настоящий code лежит
// в .cause — поэтому идём по цепочке cause до самого DatabaseError.
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null && typeof current === "object"; depth += 1) {
    if ((current as { code?: unknown }).code === PG_UNIQUE_VIOLATION) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export class WordRepository implements IWordRepository {
  public constructor(private readonly db: Database) {}

  public async create(userId: string, input: AddWordInput): Promise<Word> {
    const [row] = await this.db
      .insert(words)
      .values({
        userId,
        term: input.term,
        translation: input.translation,
        example: input.example ?? null,
        source: input.source,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create word");
    }

    return this.map(row);
  }

  public async createWithCard(
    userId: string,
    input: AddWordInput,
    card: NewReviewCardState,
  ): Promise<Word> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(words)
          .values({
            userId,
            term: input.term,
            translation: input.translation,
            example: input.example ?? null,
            source: input.source,
          })
          .returning();

        if (!row) {
          throw new Error("Failed to create word");
        }

        await tx.insert(reviewCards).values({
          wordId: row.id,
          userId,
          dueAt: card.dueAt,
          intervalMinutes: card.intervalMinutes,
          easeFactor: card.easeFactor,
          repetitions: card.repetitions,
          lapses: card.lapses,
        });

        return this.map(row);
      });
    } catch (error) {
      // Проиграли гонку с параллельной вставкой того же слова.
      if (isUniqueViolation(error)) {
        throw new AppError(`Слово «${input.term}» уже есть в словаре.`);
      }
      throw error;
    }
  }

  public async findById(wordId: string): Promise<Word | null> {
    const [row] = await this.db.select().from(words).where(eq(words.id, wordId)).limit(1);
    return row ? this.map(row) : null;
  }

  public async findByUserAndTerm(userId: string, term: string): Promise<Word | null> {
    const [row] = await this.db
      .select()
      .from(words)
      .where(and(eq(words.userId, userId), eq(words.term, term)))
      .limit(1);

    return row ? this.map(row) : null;
  }

  public async findManyByIds(wordIds: string[], userId: string): Promise<Word[]> {
    if (wordIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(words)
      .where(and(eq(words.userId, userId), inArray(words.id, wordIds)));
    return rows.map((row) => this.map(row));
  }

  public async countByUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(words)
      .where(eq(words.userId, userId));

    return row?.count ?? 0;
  }

  public async listByUser(userId: string, page: number, pageSize: number): Promise<WordPage> {
    const total = await this.countByUser(userId);
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    const safePage = Math.min(Math.max(1, page), totalPages);
    const offset = (safePage - 1) * pageSize;

    const rows = await this.db
      .select()
      .from(words)
      .where(eq(words.userId, userId))
      .orderBy(desc(words.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      items: rows.map((row) => this.map(row)),
      total,
      page: safePage,
      pageSize,
      totalPages: total === 0 ? 1 : totalPages,
    };
  }

  public async update(wordId: string, input: UpdateWordInput): Promise<Word> {
    const [row] = await this.db
      .update(words)
      .set({
        ...(input.term !== undefined ? { term: input.term } : {}),
        ...(input.translation !== undefined ? { translation: input.translation } : {}),
        ...(input.example !== undefined ? { example: input.example } : {}),
      })
      .where(eq(words.id, wordId))
      .returning();

    if (!row) {
      throw new Error("Failed to update word");
    }

    return this.map(row);
  }

  public async delete(wordId: string): Promise<void> {
    await this.db.delete(words).where(eq(words.id, wordId));
  }

  private map(row: typeof words.$inferSelect): Word {
    return new Word(
      row.id,
      row.userId,
      row.term,
      row.translation,
      row.example,
      row.source as WordSource,
      row.createdAt,
    );
  }
}

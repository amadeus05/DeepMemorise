import { and, eq, lte, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import { reviewCards, words } from "../schema.js";
import { ReviewCard } from "../../../domain/entities/ReviewCard.js";
import { Word, type WordSource } from "../../../domain/entities/Word.js";
import type {
  CreateReviewCardInput,
  DueReview,
  IReviewRepository,
  UpdateReviewCardInput,
} from "../../../ports/IReviewRepository.js";

export class ReviewRepository implements IReviewRepository {
  public constructor(private readonly db: Database) {}

  public async create(input: CreateReviewCardInput): Promise<ReviewCard> {
    const [row] = await this.db
      .insert(reviewCards)
      .values({
        wordId: input.wordId,
        userId: input.userId,
        dueAt: input.dueAt,
        intervalMinutes: input.intervalMinutes,
        easeFactor: input.easeFactor,
        repetitions: input.repetitions,
        lapses: input.lapses,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create review card");
    }

    return this.mapCard(row);
  }

  public async findDue(userId: string, now: Date, limit: number): Promise<DueReview[]> {
    const rows = await this.db
      .select({
        card: reviewCards,
        word: words,
      })
      .from(reviewCards)
      .innerJoin(words, eq(reviewCards.wordId, words.id))
      .where(and(eq(reviewCards.userId, userId), lte(reviewCards.dueAt, now)))
      .orderBy(reviewCards.dueAt)
      .limit(limit);

    return rows.map((row) => ({
      card: this.mapCard(row.card),
      word: this.mapWord(row.word),
    }));
  }

  public async findById(cardId: string): Promise<ReviewCard | null> {
    const [row] = await this.db.select().from(reviewCards).where(eq(reviewCards.id, cardId)).limit(1);
    return row ? this.mapCard(row) : null;
  }

  public async findDueById(
    cardId: string,
    userId: string,
    now: Date,
  ): Promise<DueReview | null> {
    const [row] = await this.db
      .select({
        card: reviewCards,
        word: words,
      })
      .from(reviewCards)
      .innerJoin(words, eq(reviewCards.wordId, words.id))
      .where(
        and(
          eq(reviewCards.id, cardId),
          eq(reviewCards.userId, userId),
          lte(reviewCards.dueAt, now),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      card: this.mapCard(row.card),
      word: this.mapWord(row.word),
    };
  }

  public async update(cardId: string, input: UpdateReviewCardInput): Promise<ReviewCard> {
    const [row] = await this.db
      .update(reviewCards)
      .set({
        dueAt: input.dueAt,
        intervalMinutes: input.intervalMinutes,
        easeFactor: input.easeFactor,
        repetitions: input.repetitions,
        lapses: input.lapses,
      })
      .where(eq(reviewCards.id, cardId))
      .returning();

    if (!row) {
      throw new Error("Failed to update review card");
    }

    return this.mapCard(row);
  }

  public async countDue(userId: string, now: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), lte(reviewCards.dueAt, now)));

    return row?.count ?? 0;
  }

  private mapCard(row: typeof reviewCards.$inferSelect): ReviewCard {
    return new ReviewCard(
      row.id,
      row.wordId,
      row.userId,
      row.dueAt,
      row.intervalMinutes,
      row.easeFactor,
      row.repetitions,
      row.lapses,
    );
  }

  private mapWord(row: typeof words.$inferSelect): Word {
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

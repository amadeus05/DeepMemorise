import type { ReviewCard } from "../domain/entities/ReviewCard.js";
import type { Word } from "../domain/entities/Word.js";

export type DueReview = {
  card: ReviewCard;
  word: Word;
};

export type CreateReviewCardInput = {
  wordId: string;
  userId: string;
  dueAt: Date;
  intervalMinutes: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export type UpdateReviewCardInput = {
  dueAt: Date;
  intervalMinutes: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export interface IReviewRepository {
  create(input: CreateReviewCardInput): Promise<ReviewCard>;
  findDue(userId: string, now: Date, limit: number): Promise<DueReview[]>;
  findById(cardId: string): Promise<ReviewCard | null>;
  /** Карточка со словом, если она принадлежит пользователю и всё ещё due. */
  findDueById(cardId: string, userId: string, now: Date): Promise<DueReview | null>;
  update(cardId: string, input: UpdateReviewCardInput): Promise<ReviewCard>;
  countDue(userId: string, now: Date): Promise<number>;
}

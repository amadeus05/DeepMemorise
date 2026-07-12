import type { Word } from "../domain/entities/Word.js";
import type { AddWordInput } from "../domain/types/AddWordInput.js";

export type UpdateWordInput = {
  term?: string;
  translation?: string;
  example?: string | null;
};

export type WordPage = {
  items: Word[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type NewReviewCardState = {
  dueAt: Date;
  intervalMinutes: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export interface IWordRepository {
  create(userId: string, input: AddWordInput): Promise<Word>;
  /** Слово и его карточка повторения создаются атомарно. */
  createWithCard(userId: string, input: AddWordInput, card: NewReviewCardState): Promise<Word>;
  findById(wordId: string): Promise<Word | null>;
  findByUserAndTerm(userId: string, term: string): Promise<Word | null>;
  /** Только слова, реально принадлежащие userId — остальные id молча отбрасываются. */
  findManyByIds(wordIds: string[], userId: string): Promise<Word[]>;
  countByUser(userId: string): Promise<number>;
  listByUser(userId: string, page: number, pageSize: number): Promise<WordPage>;
  update(wordId: string, input: UpdateWordInput): Promise<Word>;
  delete(wordId: string): Promise<void>;
}

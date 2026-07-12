import type { AddWordInput } from "../domain/types/AddWordInput.js";
import type { Word } from "../domain/entities/Word.js";
import type { Upload } from "../domain/entities/Upload.js";
import type { IWordRepository, UpdateWordInput, WordPage } from "../ports/IWordRepository.js";
import type { IClock } from "../ports/IClock.js";
import type { SettingsService } from "./SettingsService.js";
import type { UploadService } from "./UploadService.js";
import { AppError } from "../shared/errors/AppError.js";
import { capitalizeFirst } from "../shared/utils/capitalizeFirst.js";

export class WordService {
  public constructor(
    private readonly words: IWordRepository,
    private readonly settings: SettingsService,
    private readonly uploads: UploadService,
    private readonly clock: IClock,
  ) {}

  public async addWord(userId: string, input: AddWordInput): Promise<Word> {
    const term = capitalizeFirst(input.term);
    const translation = capitalizeFirst(input.translation);
    const example = input.example?.trim() || null;

    if (!term || !translation) {
      throw new AppError("Укажи слово и перевод.");
    }

    const existing = await this.words.findByUserAndTerm(userId, term);
    if (existing) {
      throw new AppError(`Слово «${term}» уже есть в словаре.`);
    }

    const scheduler = await this.settings.getSchedulerForUser(userId);
    const initial = scheduler.initialState(this.clock.now());

    return this.words.createWithCard(
      userId,
      { term, translation, example, source: input.source },
      {
        dueAt: initial.dueAt,
        intervalMinutes: initial.intervalMinutes,
        easeFactor: initial.easeFactor,
        repetitions: initial.repetitions,
        lapses: initial.lapses,
      },
    );
  }

  /**
   * Пакетное добавление для импорта. В отличие от addWord:
   * — методика пользователя резолвится один раз на весь список, а не на
   *   каждое слово (getSchedulerForUser — это отдельный DB round trip);
   * — нет отдельного findByUserAndTerm pre-check: дубликат ловит уникальный
   *   индекс внутри createWithCard и превращает в тот же AppError.
   * На батч из N слов это ~2N round trip'ов вместо ~6N.
   */
  public async addWordsBulk(
    userId: string,
    inputs: AddWordInput[],
  ): Promise<Array<{ ok: true; word: Word } | { ok: false; error: AppError }>> {
    const scheduler = await this.settings.getSchedulerForUser(userId);
    const results: Array<{ ok: true; word: Word } | { ok: false; error: AppError }> = [];

    for (const input of inputs) {
      const term = capitalizeFirst(input.term);
      const translation = capitalizeFirst(input.translation);
      const example = input.example?.trim() || null;

      if (!term || !translation) {
        results.push({ ok: false, error: new AppError("Укажи слово и перевод.") });
        continue;
      }

      try {
        const initial = scheduler.initialState(this.clock.now());
        const word = await this.words.createWithCard(
          userId,
          { term, translation, example, source: input.source },
          {
            dueAt: initial.dueAt,
            intervalMinutes: initial.intervalMinutes,
            easeFactor: initial.easeFactor,
            repetitions: initial.repetitions,
            lapses: initial.lapses,
          },
        );
        results.push({ ok: true, word });
      } catch (error) {
        if (error instanceof AppError) {
          results.push({ ok: false, error });
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  public async countWords(userId: string): Promise<number> {
    return this.words.countByUser(userId);
  }

  public async listWords(userId: string, page: number, pageSize = 10): Promise<WordPage> {
    return this.words.listByUser(userId, page, pageSize);
  }

  public async getWordForUser(wordId: string, userId: string): Promise<Word> {
    const word = await this.words.findById(wordId);
    if (!word || word.userId !== userId) {
      throw new AppError("Слово не найдено.");
    }
    return word;
  }

  public async getWordCover(wordId: string, userId: string): Promise<Upload | null> {
    await this.getWordForUser(wordId, userId);
    return this.uploads.coverFor("word", wordId);
  }

  public async attachWordCover(
    wordId: string,
    userId: string,
    telegramUserId: number,
    photo: {
      fileId: string;
      fileUniqueId?: string | null;
      width?: number | null;
      height?: number | null;
      fileSize?: number | null;
    },
  ): Promise<Upload> {
    await this.getWordForUser(wordId, userId);
    return this.uploads.attachWordCover({
      ownerId: wordId,
      uploadedBy: telegramUserId,
      fileId: photo.fileId,
      fileUniqueId: photo.fileUniqueId ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      fileSize: photo.fileSize ?? null,
    });
  }

  public async removeWordCover(wordId: string, userId: string): Promise<void> {
    await this.getWordForUser(wordId, userId);
    await this.uploads.removeCover("word", wordId, "cover");
  }

  public async updateWord(wordId: string, userId: string, input: UpdateWordInput): Promise<Word> {
    const word = await this.getWordForUser(wordId, userId);

    const patch: UpdateWordInput = {};

    if (input.term !== undefined) {
      const term = capitalizeFirst(input.term);
      if (!term) {
        throw new AppError("Слово не может быть пустым.");
      }
      const duplicate = await this.words.findByUserAndTerm(userId, term);
      if (duplicate && duplicate.id !== word.id) {
        throw new AppError(`Слово «${term}» уже есть в словаре.`);
      }
      patch.term = term;
    }

    if (input.translation !== undefined) {
      const translation = capitalizeFirst(input.translation);
      if (!translation) {
        throw new AppError("Перевод не может быть пустым.");
      }
      patch.translation = translation;
    }

    if (input.example !== undefined) {
      const example = input.example?.trim() || null;
      patch.example = example;
    }

    return this.words.update(wordId, patch);
  }

  public async deleteWord(wordId: string, userId: string): Promise<void> {
    await this.getWordForUser(wordId, userId);
    // Сначала слово (каскадом удалит карточку): если упадём после него,
    // останутся лишь невидимые пользователю строки uploads,
    // а не слово с отвязанным фото.
    await this.words.delete(wordId);
    await this.uploads.removeAllFor("word", wordId);
  }

  /** Для экрана подтверждения массового удаления. Чужие/несуществующие id молча отбрасываются. */
  public async getWordsForUser(wordIds: string[], userId: string): Promise<Word[]> {
    return this.words.findManyByIds(wordIds, userId);
  }

  /**
   * Массовое удаление для режима выбора в /words. В отличие от deleteWord
   * не бросает AppError на отсутствующий/чужой id (между выбором и
   * подтверждением слово могло уже исчезнуть) — просто пропускает его.
   * Возвращает, сколько реально удалено.
   */
  public async deleteWordsBulk(wordIds: string[], userId: string): Promise<number> {
    const owned = await this.words.findManyByIds(wordIds, userId);
    for (const word of owned) {
      await this.words.delete(word.id);
      await this.uploads.removeAllFor("word", word.id);
    }
    return owned.length;
  }
}

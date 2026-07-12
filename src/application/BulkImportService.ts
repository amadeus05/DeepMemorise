import type { Word } from "../domain/entities/Word.js";
import type { WordListParserRegistry } from "./import/WordListParserRegistry.js";
import type { WordService } from "./WordService.js";
import { AppError } from "../shared/errors/AppError.js";

const MAX_IMPORT_ROWS = 200;

export type ImportRowIssue = {
  row: number;
  term: string;
  reason: string;
};

export type ImportSummary = {
  added: Word[];
  duplicates: ImportRowIssue[];
  invalid: ImportRowIssue[];
};

export class BulkImportService {
  public constructor(
    private readonly parsers: WordListParserRegistry,
    private readonly words: WordService,
  ) {}

  public async importFromFile(
    userId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportSummary> {
    const parser = this.parsers.resolve(fileName);
    if (!parser) {
      throw new AppError(
        `Неподдерживаемый формат файла. Поддерживается: ${this.parsers.supportedExtensionsLabel()}`,
      );
    }

    const { rows } = parser.parse(buffer);
    if (rows.length === 0) {
      throw new AppError("В файле нет строк для импорта.");
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(`Слишком много строк (максимум ${MAX_IMPORT_ROWS} за раз).`);
    }

    const summary: ImportSummary = { added: [], duplicates: [], invalid: [] };

    // Последовательно, а не Promise.all: строки нумеруем в порядке файла,
    // не заливаем пул соединений одним залпом на большом файле.
    for (const [index, row] of rows.entries()) {
      try {
        const word = await this.words.addWord(userId, {
          term: row.term,
          translation: row.translation,
          example: row.example,
          source: "import",
        });
        summary.added.push(word);
      } catch (error) {
        const issue: ImportRowIssue = {
          row: index + 1,
          term: row.term || "(пусто)",
          reason: error instanceof AppError ? error.message : "Не удалось добавить.",
        };
        if (error instanceof AppError && error.message.includes("уже есть")) {
          summary.duplicates.push(issue);
        } else {
          summary.invalid.push(issue);
        }
      }
    }

    return summary;
  }
}

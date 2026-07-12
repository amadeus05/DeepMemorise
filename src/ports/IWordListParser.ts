export type ParsedWordRow = {
  term: string;
  translation: string;
  example: string | null;
};

export type ParseResult = {
  rows: ParsedWordRow[];
};

/**
 * Парсер файла со списком слов. Один парсер = один формат (csv, xlsx, ...).
 * Новый формат добавляется отдельной реализацией и регистрацией в
 * WordListParserRegistry — этот интерфейс и вызывающий код не меняются.
 */
export interface IWordListParser {
  readonly id: string;
  /** Расширения без точки, например ["csv"]. */
  readonly extensions: readonly string[];
  parse(buffer: Buffer): ParseResult;
}

import { parse } from "csv-parse/sync";
import type { IWordListParser, ParsedWordRow, ParseResult } from "../../ports/IWordListParser.js";

// Если первая ячейка первой строки — одно из этих слов, считаем строку
// заголовком и пропускаем (экспорт из Excel/Google Sheets обычно его добавляет).
const HEADER_TERM_LABELS = new Set(["word", "term", "слово", "термин"]);

export class CsvWordListParser implements IWordListParser {
  public readonly id = "csv";
  public readonly extensions = ["csv"] as const;

  public parse(buffer: Buffer): ParseResult {
    const records = parse(buffer, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];

    if (records.length === 0) {
      return { rows: [] };
    }

    const first = records[0];
    const looksLikeHeader = Boolean(
      first?.[0] && HEADER_TERM_LABELS.has(first[0].trim().toLowerCase()),
    );
    const dataRows = looksLikeHeader ? records.slice(1) : records;

    const rows: ParsedWordRow[] = dataRows.map((cols) => ({
      term: cols[0] ?? "",
      translation: cols[1] ?? "",
      example: cols[2]?.trim() ? cols[2] : null,
    }));

    return { rows };
  }
}

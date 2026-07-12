import type { IWordListParser } from "../../ports/IWordListParser.js";

export class WordListParserRegistry {
  private readonly parsers: Map<string, IWordListParser>;

  public constructor(parsers: IWordListParser[]) {
    this.parsers = new Map();
    for (const parser of parsers) {
      for (const ext of parser.extensions) {
        this.parsers.set(ext.toLowerCase(), parser);
      }
    }
  }

  public resolve(fileName: string): IWordListParser | null {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (!ext) {
      return null;
    }
    return this.parsers.get(ext) ?? null;
  }

  public supportedExtensionsLabel(): string {
    return [...new Set([...this.parsers.keys()])].map((ext) => `.${ext}`).join(", ");
  }
}

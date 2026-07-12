export type WordSource = "manual" | "forward" | "import";

export class Word {
  public constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly term: string,
    public readonly translation: string,
    public readonly example: string | null,
    public readonly source: WordSource,
    public readonly createdAt: Date,
  ) {}
}

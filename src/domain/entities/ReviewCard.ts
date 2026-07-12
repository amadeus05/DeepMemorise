export class ReviewCard {
  public constructor(
    public readonly id: string,
    public readonly wordId: string,
    public readonly userId: string,
    public readonly dueAt: Date,
    public readonly intervalMinutes: number,
    public readonly easeFactor: number,
    public readonly repetitions: number,
    public readonly lapses: number,
  ) {}
}

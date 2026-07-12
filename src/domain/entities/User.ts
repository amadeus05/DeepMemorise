export class User {
  public constructor(
    public readonly id: string,
    public readonly telegramId: number,
    public readonly username: string | null,
    public readonly firstName: string | null,
    public readonly createdAt: Date,
  ) {}
}

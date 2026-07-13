import type { SessionData, SessionUser } from "./context.js";
import type { WordsPageView } from "./keyboards/wordsKeyboard.js";

/**
 * Фасад над сессией grammy для двух кешей, привязанных к чату:
 *  - личность пользователя (чтобы не апсертить в БД на каждый клик);
 *  - последняя отрисованная страница словаря (чтобы перерисовывать галочки
 *    в режиме удаления без повторного запроса списка).
 *
 * Не движок кеша с TTL — хранилище уже есть (сессия), тут только правила
 * «что считается попаданием» и «что инвалидирует», собранные в одном месте.
 */
export class SessionCache {
  public constructor(private readonly session: SessionData) {}

  /** Кеш-хит только если это тот же пользователь и username/имя не менялись. */
  public getUser(
    telegramId: number,
    username: string | null,
    firstName: string | null,
  ): SessionUser | null {
    const user = this.session.cachedUser;
    if (
      user &&
      user.telegramId === telegramId &&
      user.username === username &&
      user.firstName === firstName
    ) {
      return user;
    }
    return null;
  }

  public setUser(user: SessionUser): void {
    this.session.cachedUser = user;
  }

  /** Кеш-хит только если закеширована ровно запрошенная страница. */
  public getPage(page: number): WordsPageView | null {
    const cached = this.session.pageCache;
    return cached && cached.page === page ? cached : null;
  }

  public setPage(view: WordsPageView): void {
    this.session.pageCache = view;
  }

  public clearPage(): void {
    delete this.session.pageCache;
  }
}

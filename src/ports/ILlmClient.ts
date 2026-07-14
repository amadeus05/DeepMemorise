export type LlmRequest = {
  /** Системная инструкция (роль/поведение). Опциональна. */
  system?: string;
  /** Пользовательский запрос. */
  user: string;
  /** Просить строгий JSON в ответе (response_format / responseMimeType). */
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
};

/**
 * Общий транспорт к LLM: только вызов и сырой текст ответа. Не знает про
 * задачу — промпт, форму ответа и валидацию задаёт вызывающая задача
 * (ExampleGenerator и т.п.). Провайдер меняется сменой адаптера.
 */
export interface ILlmClient {
  complete(request: LlmRequest): Promise<string>;
}

/** Транспортные ошибки клиента — задача маппит их в дружелюбный AppError. */
export class LlmError extends Error {
  public constructor(
    message: string,
    public readonly kind: "rate_limit" | "timeout" | "http" | "empty" | "network",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

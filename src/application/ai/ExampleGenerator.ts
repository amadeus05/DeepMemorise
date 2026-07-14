import type { ILlmClient } from "../../ports/ILlmClient.js";
import { LlmError } from "../../ports/ILlmClient.js";
import { AppError } from "../../shared/errors/AppError.js";

const SYSTEM =
  "You write vocabulary example sentences for a language-learning bot. " +
  "Always reply with strict JSON and nothing else.";

export class ExampleGenerator {
  public constructor(private readonly llm: ILlmClient) {}

  public async generate(term: string, translation: string): Promise<string> {
    const user = [
      `Write ONE short, natural English sentence using "${term}" (meaning: ${translation}).`,
      "It must clearly show the word's meaning and sound like everyday English.",
      'Respond as JSON: {"sentence": "..."}',
    ].join("\n");

    let raw: string;
    try {
      raw = await this.llm.complete({ system: SYSTEM, user, json: true, temperature: 0.9 });
    } catch (error) {
      if (error instanceof LlmError) {
        throw error.kind === "rate_limit"
          ? new AppError("ИИ сейчас перегружен, попробуй через минуту.")
          : new AppError("ИИ временно недоступен, попробуй позже.");
      }
      throw error;
    }

    const sentence = parseSentence(raw);
    if (!sentence) {
      throw new AppError("Не удалось разобрать ответ ИИ. Попробуй ещё раз.");
    }
    return sentence;
  }
}

/** Своя валидация поверх JSON-режима: доверять сырому ответу модели нельзя. */
function parseSentence(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "sentence" in parsed &&
    typeof (parsed as { sentence: unknown }).sentence === "string"
  ) {
    const sentence = (parsed as { sentence: string }).sentence.trim();
    return sentence.length > 0 && sentence.length <= 1000 ? sentence : null;
  }
  return null;
}

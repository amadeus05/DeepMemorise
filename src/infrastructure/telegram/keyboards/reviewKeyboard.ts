import { InlineKeyboard } from "grammy";
import type { ReviewGrade } from "../../../domain/enums/ReviewGrade.js";
import { Methodology } from "../../../domain/enums/Methodology.js";

export function reviewKeyboard(cardId: string, methodology: Methodology): InlineKeyboard {
  // Эббингауз — фиксированная лесенка: достаточно «помню / не помню».
  // «Помню» = good (шаг вверх по лесенке), «Не помню» = again (сброс на 10 минут).
  if (methodology === Methodology.Ebbinghaus) {
    return new InlineKeyboard()
      .text("✅ Помню", `review:${cardId}:good`)
      .text("🔁 Не помню", `review:${cardId}:again`);
  }

  return new InlineKeyboard()
    .text("🔁 Снова", `review:${cardId}:again`)
    .text("😓 Трудно", `review:${cardId}:hard`)
    .row()
    .text("👍 Хорошо", `review:${cardId}:good`)
    .text("🚀 Легко", `review:${cardId}:easy`);
}

export function revealKeyboard(cardId: string): InlineKeyboard {
  return new InlineKeyboard().text("👁 Показать перевод", `reveal:${cardId}`);
}

// Кнопка-приглашение в тренировку — под напоминаниями, чтобы не писать /train руками.
export const TRAIN_CTA = "train:go";

export function trainCtaKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🧠 Повторить сейчас", TRAIN_CTA);
}

export function parseReviewCallback(data: string): { cardId: string; grade: ReviewGrade } | null {
  const match = /^review:([^:]+):(again|hard|good|easy)$/.exec(data);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    cardId: match[1],
    grade: match[2] as ReviewGrade,
  };
}

export function parseRevealCallback(data: string): string | null {
  const match = /^reveal:([^:]+)$/.exec(data);
  return match?.[1] ?? null;
}

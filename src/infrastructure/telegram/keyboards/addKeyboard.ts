import { InlineKeyboard } from "grammy";
import { TRAIN_CTA } from "./reviewKeyboard.js";

export const ADD_SKIP_EXAMPLE = "add:skip";
export const ADD_MORE = "add:more";

// Кнопка на шаге примера — пропустить без ввода «-».
export function skipExampleKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("⏭ Пропустить", ADD_SKIP_EXAMPLE);
}

// После добавления — быстрые действия вместо текстовых команд /train и /add.
export function addedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎯 Тренировка", TRAIN_CTA)
    .text("➕ Ещё слово", ADD_MORE);
}

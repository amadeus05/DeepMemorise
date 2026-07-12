import { InlineKeyboard } from "grammy";
import { TRAIN_CTA } from "./reviewKeyboard.js";

export const ADD_SKIP_EXAMPLE = "add:skip";
export const ADD_MORE = "add:more";
export const ADD_CANCEL = "add:cancel";

// Экран старта добавления — отмена кнопкой вместо ввода /cancel.
export function startAddKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ Отмена", ADD_CANCEL);
}

// Кнопка на шаге примера — пропустить без ввода «-», плюс отмена рядом.
export function skipExampleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⏭ Пропустить", ADD_SKIP_EXAMPLE)
    .text("❌ Отмена", ADD_CANCEL);
}

// После добавления — быстрые действия вместо текстовых команд /train и /add.
export function addedKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎯 Тренировка", TRAIN_CTA)
    .text("➕ Ещё слово", ADD_MORE);
}

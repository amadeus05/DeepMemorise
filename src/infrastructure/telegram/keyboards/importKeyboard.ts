import { InlineKeyboard } from "grammy";
import { TRAIN_CTA } from "./reviewKeyboard.js";

export const IMPORT_CANCEL = "import:cancel";

export function importCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ Отмена", IMPORT_CANCEL);
}

export function importDoneKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🎯 Тренировка", TRAIN_CTA);
}

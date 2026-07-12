import type { Bot } from "grammy";
import type { BotContext } from "./context.js";

export const BOT_COMMANDS = [
  { command: "start", description: "Старт и статус" },
  { command: "add", description: "Добавить слово" },
  { command: "words", description: "Словарь" },
  { command: "train", description: "Тренировка" },
  { command: "settings", description: "Методика и настройки" },
  { command: "stats", description: "Статистика" },
  { command: "cancel", description: "Отменить текущий шаг" },
] as const;

export async function setupBotMenu(bot: Bot<BotContext>): Promise<void> {
  await bot.api.setMyCommands([...BOT_COMMANDS]);
}

import { Bot, session } from "grammy";
import type { AppServices, BotContext } from "./context.js";
import { initialSession } from "./context.js";
import { setupBotMenu } from "./menu.js";
import { registerStartCommand, registerStatsCommand } from "../../interfaces/telegram/commands/start.js";
import { registerAddCommand } from "../../interfaces/telegram/commands/add.js";
import { registerImportCommand } from "../../interfaces/telegram/commands/import.js";
import { registerTrainCommand } from "../../interfaces/telegram/commands/train.js";
import { registerWordsCommand } from "../../interfaces/telegram/commands/words.js";
import { registerSettingsCommand } from "../../interfaces/telegram/commands/settings.js";

export async function createBot(token: string, services: AppServices): Promise<Bot<BotContext>> {
  const bot = new Bot<BotContext>(token);

  bot.use(
    session({
      initial: initialSession,
    }),
  );

  registerStartCommand(bot, services);
  registerStatsCommand(bot, services);
  registerAddCommand(bot, services);
  registerImportCommand(bot, services, token);
  registerWordsCommand(bot, services);
  registerTrainCommand(bot, services);
  registerSettingsCommand(bot, services);

  await setupBotMenu(bot);

  bot.catch((error) => {
    console.error("Bot error:", error.error);
  });

  return bot;
}

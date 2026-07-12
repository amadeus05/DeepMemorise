import type { DailyReminderService } from "../../application/reminders/DailyReminderService.js";
import type { ShortReminderService } from "../../application/reminders/ShortReminderService.js";

const TICK_MS = 60_000;

export function startReminderWorker(
  daily: DailyReminderService,
  short: ShortReminderService,
): NodeJS.Timeout {
  console.log("Reminder worker started (daily + short, every 60s)");

  const run = () => {
    void daily.tick().catch((error: unknown) => {
      console.error("Daily reminder tick failed:", error);
    });
    void short.tick().catch((error: unknown) => {
      console.error("Short reminder tick failed:", error);
    });
  };

  run();
  return setInterval(run, TICK_MS);
}

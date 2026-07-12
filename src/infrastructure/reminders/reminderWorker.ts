import type { ShortReminderService } from "../../application/reminders/ShortReminderService.js";

const TICK_MS = 60_000;

export function startReminderWorker(short: ShortReminderService): NodeJS.Timeout {
  console.log("Reminder worker started (every 60s)");

  const run = () => {
    void short.tick().catch((error: unknown) => {
      console.error("Reminder tick failed:", error);
    });
  };

  run();
  return setInterval(run, TICK_MS);
}

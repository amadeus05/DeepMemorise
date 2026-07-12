import { InlineKeyboard } from "grammy";
import { Methodology, methodologyLabel } from "../../../domain/enums/Methodology.js";
import type { UserSettings } from "../../../domain/entities/UserSettings.js";
import {
  QUIET_HOURS_PRESETS,
  REMIND_TIME_PRESETS,
  TIMEZONE_REGIONS,
} from "../../../application/SettingsService.js";

export function settingsKeyboard(settings: UserSettings): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(
      settings.methodology === Methodology.Sm2 ? "✅ SM-2" : "SM-2",
      `set:method:${Methodology.Sm2}`,
    )
    .text(
      settings.methodology === Methodology.Ebbinghaus ? "✅ Эббингауз" : "Эббингауз",
      `set:method:${Methodology.Ebbinghaus}`,
    )
    .row()
    .text(
      settings.remindersEnabled ? "🔔 Дневное: вкл" : "🔔 Дневное: выкл",
      "set:remind:toggle",
    )
    .row()
    .text(
      settings.shortRemindersEnabled ? "⚡ Короткие: вкл" : "⚡ Короткие: выкл",
      "set:remind:short",
    );

  if (settings.remindersEnabled) {
    keyboard.row().text("🕒 Время дня", "set:remind:times");
  }

  if (settings.shortRemindersEnabled) {
    keyboard.row().text("🌙 Тихие часы", "set:remind:quiet");
  }

  if (settings.remindersEnabled || settings.shortRemindersEnabled) {
    keyboard.row().text("🌍 Часовой пояс", "set:remind:zones");
  }

  return keyboard;
}

export function remindTimesKeyboard(current: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const [index, time] of REMIND_TIME_PRESETS.entries()) {
    const label = current === time ? `✅ ${time}` : time;
    keyboard.text(label, `set:remind:at:${time}`);
    if (index % 3 === 2) {
      keyboard.row();
    }
  }
  keyboard.row().text("← Назад", "set:back");
  return keyboard;
}

export function quietHoursKeyboard(start: string, end: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const preset of QUIET_HOURS_PRESETS) {
    const active = start === preset.start && end === preset.end;
    const label = active ? `✅ ${preset.label}` : preset.label;
    keyboard.text(label, `set:remind:qh:${preset.start}-${preset.end}`).row();
  }
  keyboard.text("← Назад", "set:back");
  return keyboard;
}

// Первый экран выбора пояса: регионы. Точкой помечен регион с текущей зоной.
export function remindRegionsKeyboard(currentTz: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (let i = 0; i < TIMEZONE_REGIONS.length; i += 2) {
    for (const region of TIMEZONE_REGIONS.slice(i, i + 2)) {
      const active = region.zones.some((z) => z.tz === currentTz);
      keyboard.text(active ? `✅ ${region.name}` : region.name, `set:remind:zreg:${region.id}`);
    }
    keyboard.row();
  }
  keyboard.text("← Назад", "set:back");
  return keyboard;
}

// Второй экран: города выбранного региона. «Назад» ведёт к списку регионов.
export function remindZonesKeyboard(
  regionId: string,
  current: string,
  labelFor: (tz: string) => string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const zones = TIMEZONE_REGIONS.find((r) => r.id === regionId)?.zones ?? [];
  for (let i = 0; i < zones.length; i += 2) {
    for (const { tz } of zones.slice(i, i + 2)) {
      const short = labelFor(tz);
      const label = current === tz ? `✅ ${short}` : short;
      keyboard.text(label, `set:remind:tz:${tz}`);
    }
    keyboard.row();
  }
  keyboard.text("← Регионы", "set:remind:zones");
  return keyboard;
}

export function parseMethodologyCallback(data: string): string | null {
  const match = /^set:method:(sm2|ebbinghaus)$/.exec(data);
  return match?.[1] ?? null;
}

export function parseRemindAtCallback(data: string): string | null {
  const match = /^set:remind:at:(\d{2}:\d{2})$/.exec(data);
  return match?.[1] ?? null;
}

export function parseRemindTimezoneCallback(data: string): string | null {
  const match = /^set:remind:tz:(.+)$/.exec(data);
  return match?.[1] ?? null;
}

export function parseRegionCallback(data: string): string | null {
  const match = /^set:remind:zreg:([a-z]{2})$/.exec(data);
  return match?.[1] ?? null;
}

export function parseQuietHoursCallback(
  data: string,
): { start: string; end: string } | null {
  const match = /^set:remind:qh:(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(data);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  return { start: match[1], end: match[2] };
}

export function methodologyHelp(id: string): string {
  if (id === Methodology.Ebbinghaus) {
    return [
      methodologyLabel(Methodology.Ebbinghaus),
      "Ступени: 10м → 30м → 1ч → 9ч → 1д → 2д → 6д → 31д",
      "«Помню» — шаг вперёд по лесенке, «Не помню» — назад на 10 минут.",
    ].join("\n");
  }

  return [
    methodologyLabel(Methodology.Sm2),
    "Интервал умножается на ease-фактор: Hard растёт медленно, Good — как ease, Easy — быстрее всех.",
    "Again сбрасывает карточку на 10 минут.",
  ].join("\n");
}

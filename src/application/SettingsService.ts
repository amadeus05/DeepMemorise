import type { Methodology } from "../domain/enums/Methodology.js";
import { Methodology as MethodologyEnum, methodologyLabel } from "../domain/enums/Methodology.js";
import { UserSettings } from "../domain/entities/UserSettings.js";
import type { ISettingsRepository } from "../ports/ISettingsRepository.js";
import type { SchedulerRegistry } from "./scheduling/SchedulerRegistry.js";
import type { ISchedulerStrategy } from "./scheduling/ISchedulerStrategy.js";
import { isValidRemindAt } from "./reminders/dailyReminderLogic.js";
import { AppError } from "../shared/errors/AppError.js";
import { escapeHtml } from "../shared/utils/telegramHtml.js";

// Пояса сгруппированы по регионам: выбор «регион → город» покрывает весь мир,
// но без простыни из 400+ кнопок. Смещение (UTC±) не хардкодим, а считаем вживую
// через Intl — оно верное и при переходе на летнее время (Европа/США переходят,
// РФ нет). DST полностью держит само IANA-имя зоны.
export type TimezoneRegion = {
  id: string;
  name: string;
  zones: { tz: string; city: string }[];
};

export const TIMEZONE_REGIONS: TimezoneRegion[] = [
  {
    id: "eu",
    name: "🌍 Европа",
    zones: [
      { tz: "Europe/Lisbon", city: "Лиссабон" },
      { tz: "Europe/London", city: "Лондон" },
      { tz: "Europe/Madrid", city: "Мадрид" },
      { tz: "Europe/Paris", city: "Париж" },
      { tz: "Europe/Berlin", city: "Берлин" },
      { tz: "Europe/Rome", city: "Рим" },
      { tz: "Europe/Warsaw", city: "Варшава" },
      { tz: "Europe/Kyiv", city: "Киев" },
      { tz: "Europe/Kaliningrad", city: "Калининград" },
      { tz: "Europe/Minsk", city: "Минск" },
      { tz: "Europe/Athens", city: "Афины" },
      { tz: "Europe/Moscow", city: "Москва" },
      { tz: "Europe/Istanbul", city: "Стамбул" },
    ],
  },
  {
    id: "am",
    name: "🌎 Америка",
    zones: [
      { tz: "Pacific/Honolulu", city: "Гонолулу" },
      { tz: "America/Anchorage", city: "Анкоридж" },
      { tz: "America/Los_Angeles", city: "Лос-Анджелес" },
      { tz: "America/Denver", city: "Денвер" },
      { tz: "America/Chicago", city: "Чикаго" },
      { tz: "America/New_York", city: "Нью-Йорк" },
      { tz: "America/Mexico_City", city: "Мехико" },
      { tz: "America/Bogota", city: "Богота" },
      { tz: "America/Sao_Paulo", city: "Сан-Паулу" },
      { tz: "America/Argentina/Buenos_Aires", city: "Буэнос-Айрес" },
    ],
  },
  {
    id: "as",
    name: "🌏 Азия",
    zones: [
      { tz: "Asia/Jerusalem", city: "Иерусалим" },
      { tz: "Asia/Tbilisi", city: "Тбилиси" },
      { tz: "Asia/Yerevan", city: "Ереван" },
      { tz: "Asia/Baku", city: "Баку" },
      { tz: "Asia/Dubai", city: "Дубай" },
      { tz: "Asia/Tehran", city: "Тегеран" },
      { tz: "Asia/Yekaterinburg", city: "Екатеринбург" },
      { tz: "Asia/Karachi", city: "Карачи" },
      { tz: "Asia/Tashkent", city: "Ташкент" },
      { tz: "Asia/Almaty", city: "Алматы" },
      { tz: "Asia/Kolkata", city: "Дели" },
      { tz: "Asia/Omsk", city: "Омск" },
      { tz: "Asia/Dhaka", city: "Дакка" },
      { tz: "Asia/Bangkok", city: "Бангкок" },
      { tz: "Asia/Novosibirsk", city: "Новосибирск" },
      { tz: "Asia/Shanghai", city: "Пекин" },
      { tz: "Asia/Singapore", city: "Сингапур" },
      { tz: "Asia/Tokyo", city: "Токио" },
      { tz: "Asia/Seoul", city: "Сеул" },
      { tz: "Asia/Irkutsk", city: "Иркутск" },
      { tz: "Asia/Yakutsk", city: "Якутск" },
      { tz: "Asia/Vladivostok", city: "Владивосток" },
      { tz: "Asia/Magadan", city: "Магадан" },
      { tz: "Asia/Kamchatka", city: "Камчатка" },
    ],
  },
  {
    id: "af",
    name: "🌍 Африка",
    zones: [
      { tz: "Africa/Casablanca", city: "Касабланка" },
      { tz: "Africa/Lagos", city: "Лагос" },
      { tz: "Africa/Cairo", city: "Каир" },
      { tz: "Africa/Nairobi", city: "Найроби" },
      { tz: "Africa/Johannesburg", city: "Йоханнесбург" },
    ],
  },
  {
    id: "oc",
    name: "🌏 Океания",
    zones: [
      { tz: "Australia/Perth", city: "Перт" },
      { tz: "Australia/Adelaide", city: "Аделаида" },
      { tz: "Australia/Sydney", city: "Сидней" },
      { tz: "Pacific/Auckland", city: "Окленд" },
    ],
  },
];

const TIMEZONE_CITIES: Record<string, string> = Object.fromEntries(
  TIMEZONE_REGIONS.flatMap((region) => region.zones.map((z) => [z.tz, z.city])),
);

/** Текущее смещение зоны в виде "+3" / "-5" / "+0" (с учётом DST на сейчас). */
function timezoneOffset(timezone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return (part?.value ?? "GMT").replace("GMT", "") || "+0";
  } catch {
    return "+0";
  }
}

export const REMIND_TIME_PRESETS = ["09:00", "12:00", "15:00", "18:00", "20:00", "21:00"] as const;
export const TIMEZONE_PRESETS = Object.keys(TIMEZONE_CITIES);

export const QUIET_HOURS_PRESETS = [
  { start: "23:00", end: "08:00", label: "23:00–08:00" },
  { start: "22:00", end: "09:00", label: "22:00–09:00" },
  { start: "00:00", end: "07:00", label: "00:00–07:00" },
  { start: "01:00", end: "09:00", label: "01:00–09:00" },
] as const;

export class SettingsService {
  public constructor(
    private readonly settings: ISettingsRepository,
    private readonly schedulers: SchedulerRegistry,
  ) {}

  public async getOrCreate(userId: string): Promise<UserSettings> {
    const existing = await this.settings.getByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.settings.upsertMethodology(userId, MethodologyEnum.Sm2);
  }

  public async getMethodology(userId: string): Promise<Methodology> {
    const settings = await this.getOrCreate(userId);
    return settings.methodology;
  }

  public async setMethodology(userId: string, methodology: Methodology): Promise<UserSettings> {
    return this.settings.upsertMethodology(userId, methodology);
  }

  public async setRemindersEnabled(userId: string, enabled: boolean): Promise<UserSettings> {
    await this.getOrCreate(userId);
    return this.settings.updateReminders(userId, { remindersEnabled: enabled });
  }

  public async setShortRemindersEnabled(userId: string, enabled: boolean): Promise<UserSettings> {
    await this.getOrCreate(userId);
    return this.settings.updateReminders(userId, { shortRemindersEnabled: enabled });
  }

  public async setRemindAt(userId: string, remindAt: string): Promise<UserSettings> {
    if (!isValidRemindAt(remindAt)) {
      throw new AppError("Время должно быть в формате HH:MM");
    }
    await this.getOrCreate(userId);
    return this.settings.updateReminders(userId, { remindAt });
  }

  public async setTimezone(userId: string, timezone: string): Promise<UserSettings> {
    if (!TIMEZONE_PRESETS.includes(timezone)) {
      throw new AppError("Неизвестная таймзона.");
    }
    await this.getOrCreate(userId);
    return this.settings.updateReminders(userId, { timezone });
  }

  public async setQuietHours(
    userId: string,
    quietHoursStart: string,
    quietHoursEnd: string,
  ): Promise<UserSettings> {
    if (!isValidRemindAt(quietHoursStart) || !isValidRemindAt(quietHoursEnd)) {
      throw new AppError("Тихие часы: формат HH:MM");
    }
    await this.getOrCreate(userId);
    return this.settings.updateReminders(userId, { quietHoursStart, quietHoursEnd });
  }

  public async markDailyReminderSent(userId: string, localDate: string): Promise<void> {
    await this.settings.updateReminders(userId, { lastDailyReminderOn: localDate });
  }

  public async markShortReminderSent(userId: string, at: Date): Promise<void> {
    await this.settings.updateReminders(userId, { lastShortReminderAt: at });
  }

  public listReminderCandidates() {
    return this.settings.listReminderCandidates();
  }

  public listShortReminderCandidates() {
    return this.settings.listShortReminderCandidates();
  }

  public async getSchedulerForUser(userId: string): Promise<ISchedulerStrategy> {
    const methodology = await this.getMethodology(userId);
    return this.schedulers.get(methodology);
  }

  public formatSettings(settings: UserSettings): string {
    const daily = settings.remindersEnabled
      ? `вкл · ${escapeHtml(settings.remindAt)} · ${escapeHtml(this.timezoneLabel(settings.timezone))}`
      : "выкл";

    const short = settings.shortRemindersEnabled
      ? `вкл · тихие ${escapeHtml(settings.quietHoursStart)}–${escapeHtml(settings.quietHoursEnd)}`
      : "выкл";

    return [
      "<b>⚙️ Настройки Deep Memorise</b>",
      "",
      `<b>Методика:</b> <i>${escapeHtml(methodologyLabel(settings.methodology))}</i>`,
      `<b>Дневное напоминание:</b> <i>${daily}</i>`,
      `<b>Короткие (Эббингауз):</b> <i>${short}</i>`,
      "",
      "<i>Пуши не двигают dueAt — только зовут в /train.</i>",
    ].join("\n");
  }

  /** Полная подпись со смещением: «Киев (UTC+3)». */
  public timezoneLabel(timezone: string): string {
    const city = TIMEZONE_CITIES[timezone] ?? timezone;
    return `${city} (UTC${timezoneOffset(timezone)})`;
  }

  /** Компактная подпись для кнопки: «Киев +3». */
  public timezoneButtonLabel(timezone: string): string {
    const city = TIMEZONE_CITIES[timezone] ?? timezone;
    return `${city} ${timezoneOffset(timezone)}`;
  }
}

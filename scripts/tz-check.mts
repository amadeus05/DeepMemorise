import {
  SettingsService,
  TIMEZONE_PRESETS,
  TIMEZONE_REGIONS,
} from "../src/application/SettingsService.js";
import {
  remindRegionsKeyboard,
  remindZonesKeyboard,
  parseRegionCallback,
} from "../src/infrastructure/telegram/keyboards/settingsKeyboard.js";
import { getZonedClock } from "../src/application/reminders/dailyReminderLogic.js";

const svc = new SettingsService({} as never, {} as never);
let fails = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fails++; console.log("  FAIL:", msg); } };

// 1. Все зоны реально работают в Intl (функциональная проверка, а не сверка
// с supportedValuesOf — тот отдаёт только канонические имена и не знает про
// рабочие алиасы вроде Europe/Kyiv / Asia/Kolkata).
console.log("Всего зон:", TIMEZONE_PRESETS.length, "| регионов:", TIMEZONE_REGIONS.length);
for (const tz of TIMEZONE_PRESETS) {
  let works = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    works = false;
  }
  ok(works, `зона не работает в Intl: ${tz}`);
}

// 2. Callback-данные влезают в лимит Telegram (64 байта)
const longest = TIMEZONE_PRESETS.reduce((a, b) => (a.length > b.length ? a : b));
const cbLen = Buffer.byteLength(`set:remind:tz:${longest}`);
ok(cbLen <= 64, `callback длиннее 64 байт: ${cbLen}`);
console.log("Самый длинный callback:", cbLen, "байт (лимит 64)");

// 3. Покрытие мира — печатаем каждый регион с городами и живым offset
for (const region of TIMEZONE_REGIONS) {
  console.log(`\n${region.name}:`);
  for (const { tz } of region.zones) {
    console.log("   " + svc.timezoneButtonLabel(tz));
  }
}

// 4. Спот-чек ключевых точек мира, которых раньше не было
console.log("\nСпот-чек проблемных ранее мест:");
for (const [tz, want] of [
  ["America/Chicago", "Чикаго"],
  ["Asia/Kolkata", "Дели"],
  ["Asia/Jerusalem", "Иерусалим"],
  ["Europe/Madrid", "Мадрид"],
  ["Europe/Rome", "Рим"],
  ["Pacific/Auckland", "Окленд"],
] as const) {
  const inList = TIMEZONE_PRESETS.includes(tz);
  ok(inList, `нет в списке: ${tz}`);
  console.log(`   ${want}: ${inList ? svc.timezoneButtonLabel(tz) : "ОТСУТСТВУЕТ"}`);
}

// 5. getZonedClock для разных зон (движок напоминаний)
const probe = new Date("2026-07-12T12:00:00Z");
console.log("\ngetZonedClock @12:00Z:");
for (const tz of ["Europe/Kyiv", "America/Chicago", "Asia/Tokyo", "Asia/Kolkata"]) {
  const z = getZonedClock(probe, tz);
  console.log(`   ${tz.padEnd(18)} -> ${z.date} ${z.time}`);
  ok(/^\d{2}:\d{2}$/.test(z.time), `битое время для ${tz}`);
}

// 6. Клавиатура регионов
const rk = remindRegionsKeyboard("Europe/Kyiv").inline_keyboard;
ok(Math.max(...rk.map((r) => r.length)) <= 2, "регионы: >2 в ряду");
const rkLast = rk[rk.length - 1];
ok(rkLast?.length === 1 && (rkLast[0] as { text: string }).text.includes("Назад"), "регионы: нет «Назад»");
const euBtn = rk.flat().find((b) => (b as { callback_data?: string }).callback_data === "set:remind:zreg:eu");
ok((euBtn as { text: string })?.text.startsWith("✅"), "регион Европа не помечен для Киева");
console.log("\nРегионов-строк:", rk.length, "| Европа помечена ✅ для Киева:", (euBtn as { text: string })?.text.startsWith("✅"));

// 7. parseRegionCallback
ok(parseRegionCallback("set:remind:zreg:eu") === "eu", "parseRegionCallback eu");
ok(parseRegionCallback("set:remind:zreg:xx") === "xx", "parseRegionCallback 2 буквы");
ok(parseRegionCallback("set:remind:tz:Europe/Kyiv") === null, "parseRegionCallback не должен ловить tz");

// 8. Клавиатура городов региона + «Регионы» назад
const zk = remindZonesKeyboard("eu", "Europe/Kyiv", (tz) => svc.timezoneButtonLabel(tz)).inline_keyboard;
ok(Math.max(...zk.map((r) => r.length)) <= 2, "города: >2 в ряду");
const zkLast = zk[zk.length - 1];
ok(zkLast?.length === 1 && (zkLast[0] as { text: string }).text.includes("Регионы"), "города: нет «Регионы»");
const kyivBtn = zk.flat().find((b) => (b as { callback_data?: string }).callback_data === "set:remind:tz:Europe/Kyiv");
ok((kyivBtn as { text: string })?.text.startsWith("✅"), "Киев не помечен ✅");

console.log("\n" + (fails === 0 ? "ВСЕ ПРОВЕРКИ ПРОШЛИ ✅" : `ПРОВАЛОВ: ${fails}`));

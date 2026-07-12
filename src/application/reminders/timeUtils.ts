/** Локальные дата/время пользователя в IANA timezone. */
export type ZonedClock = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

export function getZonedClock(now: Date, timeZone: string): ZonedClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );

  const year = map.year ?? "1970";
  const month = map.month ?? "01";
  const day = map.day ?? "01";
  const hour = map.hour ?? "00";
  const minute = map.minute ?? "00";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

export function isValidRemindAt(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function compareHhMm(a: string, b: string): number {
  return a.localeCompare(b);
}

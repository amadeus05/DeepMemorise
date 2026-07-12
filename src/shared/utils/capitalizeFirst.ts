/** Делает первую букву заглавной, остальное не трогает. */
export function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const chars = [...trimmed];
  const first = chars[0];
  if (!first) {
    return trimmed;
  }

  chars[0] = first.toLocaleUpperCase("ru-RU");
  return chars.join("");
}

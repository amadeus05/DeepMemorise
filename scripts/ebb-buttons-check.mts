import { reviewKeyboard, parseReviewCallback } from "../src/infrastructure/telegram/keyboards/reviewKeyboard.js";
import { Methodology } from "../src/domain/enums/Methodology.js";
import { EbbinghausScheduler } from "../src/application/scheduling/EbbinghausScheduler.js";
import { formatInterval } from "../src/application/scheduling/ISchedulerStrategy.js";

const CARD = "card-1";

function buttons(m: Methodology) {
  // grammy InlineKeyboard хранит ряды в .inline_keyboard
  const rows = reviewKeyboard(CARD, m).inline_keyboard;
  return rows.flat().map((b) => ({
    text: (b as { text: string }).text,
    data: (b as { callback_data?: string }).callback_data ?? "",
  }));
}

console.log("=== Эббингауз: клавиатура ===");
const ebbBtns = buttons(Methodology.Ebbinghaus);
for (const b of ebbBtns) console.log(`  "${b.text}" -> ${b.data} (grade: ${parseReviewCallback(b.data)?.grade})`);
console.log("  кнопок:", ebbBtns.length, ebbBtns.length === 2 ? "OK" : "FAIL");

console.log("=== SM-2: клавиатура ===");
const sm2Btns = buttons(Methodology.Sm2);
for (const b of sm2Btns) console.log(`  "${b.text}" -> ${b.data} (grade: ${parseReviewCallback(b.data)?.grade})`);
console.log("  кнопок:", sm2Btns.length, sm2Btns.length === 4 ? "OK" : "FAIL");

console.log("=== Что делают кнопки Эббингауза по лесенке ===");
const ebb = new EbbinghausScheduler();
const now = new Date("2026-07-12T12:00:00Z");

// «Помню» пять раз подряд с новой карточки
let s = ebb.initialState(now);
const climb: string[] = [];
for (let i = 0; i < 6; i++) {
  s = ebb.schedule(s, "good", now); // «Помню» = good
  climb.push(formatInterval(s.intervalMinutes));
}
console.log("  «Помню» ×6:", climb.join(" → "));

// Забыл на третьей ступени → «Не помню»
let s2 = ebb.initialState(now);
s2 = ebb.schedule(s2, "good", now);
s2 = ebb.schedule(s2, "good", now);
s2 = ebb.schedule(s2, "good", now);
const before = formatInterval(s2.intervalMinutes);
s2 = ebb.schedule(s2, "again", now); // «Не помню» = again
console.log(`  «Не помню» с «${before}» -> «${formatInterval(s2.intervalMinutes)}» (ожидаем 10 мин):`,
  s2.intervalMinutes === 10 ? "OK" : "FAIL");

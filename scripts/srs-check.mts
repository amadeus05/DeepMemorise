import { Sm2Scheduler } from "../src/application/scheduling/Sm2Scheduler.js";
import { EbbinghausScheduler } from "../src/application/scheduling/EbbinghausScheduler.js";
import { formatInterval, type ISchedulerStrategy } from "../src/application/scheduling/ISchedulerStrategy.js";
import type { ReviewGrade } from "../src/domain/enums/ReviewGrade.js";

function run(scheduler: ISchedulerStrategy, grades: ReviewGrade[]): string {
  const now = new Date("2026-07-12T12:00:00Z");
  let state = scheduler.initialState(now);
  const chain: string[] = [];
  for (const grade of grades) {
    state = scheduler.schedule(state, grade, now);
    chain.push(`${grade}→${formatInterval(state.intervalMinutes)}`);
  }
  return chain.join(", ");
}

const sm2 = new Sm2Scheduler();
const ebb = new EbbinghausScheduler();

console.log("Ebbinghaus, всё «Хорошо»:");
console.log(" ", run(ebb, ["good", "good", "good", "good", "good", "good", "good", "good", "good"]));
console.log("Ebbinghaus, забыл на 3-м:");
console.log(" ", run(ebb, ["good", "good", "again", "good", "good"]));
console.log("Ebbinghaus, первый ответ «Легко»:");
console.log(" ", run(ebb, ["easy", "good"]));

console.log("SM-2, всё «Хорошо»:");
console.log(" ", run(sm2, ["good", "good", "good", "good"]));
console.log("SM-2, зрелая карточка: трудно vs хорошо vs легко (4-й ответ):");
console.log("  hard:", run(sm2, ["good", "good", "good", "hard"]));
console.log("  good:", run(sm2, ["good", "good", "good", "good"]));
console.log("  easy:", run(sm2, ["good", "good", "good", "easy"]));

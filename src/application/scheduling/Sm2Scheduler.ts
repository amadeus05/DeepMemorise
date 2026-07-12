import type { ReviewGrade } from "../../domain/enums/ReviewGrade.js";
import {
  addMinutes,
  type ISchedulerStrategy,
  type SrsResult,
  type SrsState,
} from "./ISchedulerStrategy.js";

/**
 * Упрощённый SM-2. Интервалы считаем в минутах.
 */
export class Sm2Scheduler implements ISchedulerStrategy {
  public readonly id = "sm2";
  public readonly label = "SM-2";

  public initialState(now: Date): SrsResult {
    return {
      intervalMinutes: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      dueAt: now,
    };
  }

  public schedule(state: SrsState, grade: ReviewGrade, now: Date): SrsResult {
    let { intervalMinutes, easeFactor, repetitions, lapses } = state;

    if (grade === "again") {
      repetitions = 0;
      lapses += 1;
      intervalMinutes = 10;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      if (repetitions === 0) {
        intervalMinutes = grade === "easy" ? 3 * 1440 : 1 * 1440;
      } else if (repetitions === 1) {
        intervalMinutes =
          grade === "easy" ? 7 * 1440 : grade === "hard" ? 3 * 1440 : 4 * 1440;
      } else {
        const days = Math.max(1, intervalMinutes / 1440);
        // «Трудно» растёт медленно и без ease, иначе обгонит «Хорошо».
        const factor =
          grade === "hard" ? 1.2 : grade === "easy" ? easeFactor * 1.4 : easeFactor;
        intervalMinutes = Math.max(1440, Math.round(days * factor * 1440));
      }

      repetitions += 1;

      if (grade === "hard") {
        easeFactor = Math.max(1.3, easeFactor - 0.15);
      } else if (grade === "easy") {
        easeFactor += 0.15;
      }
    }

    return {
      intervalMinutes,
      easeFactor: Number(easeFactor.toFixed(2)),
      repetitions,
      lapses,
      dueAt: addMinutes(now, intervalMinutes),
    };
  }
}

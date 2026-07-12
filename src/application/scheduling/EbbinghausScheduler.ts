import type { ReviewGrade } from "../../domain/enums/ReviewGrade.js";
import {
  addMinutes,
  type ISchedulerStrategy,
  type SrsResult,
  type SrsState,
} from "./ISchedulerStrategy.js";

/**
 * Ступени Эббингауза (минуты):
 * 10м → 30м → 1ч → 9ч → 1д → 2д → 6д → 31д
 */
const STEPS_MINUTES = [10, 30, 60, 540, 1440, 2880, 8640, 44640] as const;

export class EbbinghausScheduler implements ISchedulerStrategy {
  public readonly id = "ebbinghaus";
  public readonly label = "Эббингауз";

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
    const maxStep = STEPS_MINUTES.length - 1;
    // repetitions хранит уже пройденную ступень; новая карточка (interval 0)
    // ещё не проходила ни одной — первый успех должен дать ступень 0 (10 мин).
    const isNew = state.intervalMinutes <= 0 && state.repetitions === 0;
    let step = Math.max(0, Math.min(state.repetitions, maxStep));
    let lapses = state.lapses;

    if (grade === "again") {
      step = 0;
      lapses += 1;
    } else if (grade === "hard") {
      step = Math.max(0, step - 1);
    } else if (grade === "good") {
      step = isNew ? 0 : Math.min(maxStep, step + 1);
    } else {
      step = isNew ? 1 : Math.min(maxStep, step + 2);
    }

    const intervalMinutes = STEPS_MINUTES[step] ?? STEPS_MINUTES[0];

    return {
      intervalMinutes,
      easeFactor: state.easeFactor,
      repetitions: step,
      lapses,
      dueAt: addMinutes(now, intervalMinutes),
    };
  }
}

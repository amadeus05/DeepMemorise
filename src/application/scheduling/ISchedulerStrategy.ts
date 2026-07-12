import type { ReviewGrade } from "../../domain/enums/ReviewGrade.js";

export type SrsState = {
  /** Интервал до следующего повтора в минутах (источник правды для dueAt). */
  intervalMinutes: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export type SrsResult = SrsState & {
  dueAt: Date;
};

export interface ISchedulerStrategy {
  readonly id: string;
  readonly label: string;
  initialState(now: Date): SrsResult;
  schedule(state: SrsState, grade: ReviewGrade, now: Date): SrsResult;
}

export function addMinutes(now: Date, minutes: number): Date {
  return new Date(now.getTime() + minutes * 60_000);
}

export function formatInterval(minutes: number): string {
  if (minutes <= 0) {
    return "сразу";
  }
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `${hours} ч`;
  }
  const days = Math.round(minutes / 1440);
  return `${days} дн`;
}

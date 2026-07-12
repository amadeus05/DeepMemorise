export const ReviewGrade = {
  Again: "again",
  Hard: "hard",
  Good: "good",
  Easy: "easy",
} as const;

export type ReviewGrade = (typeof ReviewGrade)[keyof typeof ReviewGrade];

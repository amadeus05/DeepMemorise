export const Methodology = {
  Sm2: "sm2",
  Ebbinghaus: "ebbinghaus",
} as const;

export type Methodology = (typeof Methodology)[keyof typeof Methodology];

export function isMethodology(value: string): value is Methodology {
  return value === Methodology.Sm2 || value === Methodology.Ebbinghaus;
}

export function methodologyLabel(value: Methodology): string {
  switch (value) {
    case Methodology.Sm2:
      return "SM-2 (Again / Hard / Good / Easy)";
    case Methodology.Ebbinghaus:
      return "Эббингауз (Помню / Не помню)";
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

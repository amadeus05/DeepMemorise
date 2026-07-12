import type { WordSource } from "../entities/Word.js";

export type AddWordInput = {
  term: string;
  translation: string;
  example?: string | null;
  source: WordSource;
};

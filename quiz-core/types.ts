export interface Word {
  id: string;
  word: string;
  meaning: string;
  examples: string[];
  origin?: string;
  funnyWrong?: string[];
  addedAt: string;
  locale?: string;
  status?: "active" | "retired";
}

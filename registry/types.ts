export interface Word {
  id: string; locale: string; kind: "word"; word: string; meaning: string;
  examples: string[]; origin?: string; funnyWrong: string[]; sources: string[];
  addedBy: "auto" | "human" | "report"; addedAt: string; status: "active" | "retired";
}
export interface LoadedWord { path: string; folderLocale: string; fileName: string; data: unknown }
export interface LoadedConfig { path: string; fileName: string; data: unknown; parseError?: string }
export interface Problem { file: string; rule: string; message: string }
export interface CheckContext {
  words: LoadedWord[];
  configs?: LoadedConfig[];           // config/remote/<로케일>.json
  banned: Record<string, string[]>;   // locale → 금지어
  changedFiles: string[];             // PR 이 바꾼 파일
  deletedFiles: string[];             // PR 이 지운 파일
  root?: string;                      // 있으면 임시 폴더에 실제로 묶어 본다
  isBot: boolean;                     // head 브랜치가 auto/ 로 시작
}

export type RunResult = { code: number; stdout: string; stderr: string };
export type RunOptions = { input?: string };
export type Run = (cmd: string, args: string[], options?: RunOptions) => RunResult;

export type ReviewMode = "full" | "incremental";
export type Decision = "APPROVE" | "REQUEST_CHANGES";
export type GithubEvent = Decision | "COMMENT";

export type PrMeta = {
  number: number;
  title: string;
  body: string;
  authorLogin: string;
  baseRefName: string;
  headRefName: string;
  headSha: string;
};

export type ReviewComment = { path: string; line: number; body: string };

export type AddedLines = Map<string, Set<number>>;

export type PreviousReview = { body: string; headSha: string; url: string };

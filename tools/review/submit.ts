import { writeFileSync } from "node:fs";
import type { Decision, GithubEvent, ReviewComment, Run } from "./types";

export const OWN_PR_NOTE = "> 내 PR이라 GitHub 리뷰 종류는 COMMENT 다. 판정은 아래 줄이 기준이다.";

export type ReviewPayload = {
  commit_id: string;
  event: GithubEvent;
  body: string;
  comments: Array<{ path: string; line: number; side: "RIGHT"; body: string }>;
};

type PayloadInput = {
  headSha: string;
  body: string;
  decision: Decision;
  comments: ReviewComment[];
  authorLogin: string;
  viewerLogin: string;
};

function withNote(body: string): string {
  const [marker = "", ...rest] = body.split("\n");
  return [marker, OWN_PR_NOTE, "", ...rest].join("\n");
}

export function buildReviewPayload(input: PayloadInput): ReviewPayload {
  const own = input.authorLogin === input.viewerLogin;
  return {
    commit_id: input.headSha,
    event: own ? "COMMENT" : input.decision,
    body: own ? withNote(input.body) : input.body,
    comments: input.comments.map((c) => ({ path: c.path, line: c.line, side: "RIGHT", body: c.body })),
  };
}

export type SubmitResult = { ok: true; url: string } | { ok: false; error: string };

export function submitReview(payload: ReviewPayload, prNumber: number, payloadPath: string, run: Run): SubmitResult {
  writeFileSync(payloadPath, JSON.stringify(payload));
  const result = run("gh", ["api", "-X", "POST", `repos/{owner}/{repo}/pulls/${prNumber}/reviews`, "--input", payloadPath]);
  if (result.code !== 0) return { ok: false, error: `리뷰 게시에 실패했다: ${result.stderr.trim() || result.stdout.trim()}` };
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    const url = typeof parsed === "object" && parsed !== null && "html_url" in parsed ? parsed.html_url : undefined;
    return { ok: true, url: typeof url === "string" ? url : "(주소를 응답에서 읽지 못했다)" };
  } catch {
    return { ok: true, url: "(주소를 응답에서 읽지 못했다)" };
  }
}

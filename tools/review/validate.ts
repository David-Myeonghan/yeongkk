import { parseMarker } from "./marker";
import type { AddedLines, Decision, ReviewComment, ReviewMode } from "./types";

export const OUT_DIR = "review-out";
export const OUT_FILES = {
  review: "review.md",
  decision: "decision.txt",
  comments: "comments.json",
  execution: "execution.jsonl",
  payload: "payload.json",
} as const;

export const BODY_CAP = 8000;

const VERDICT = /^\*\*판정: (APPROVE|REQUEST_CHANGES)\*\*\s*$/gm;

export type ReviewOutput = {
  expected: { headSha: string; mode: ReviewMode };
  body: string;
  decision: string;
  comments: string | undefined;
  addedLines: AddedLines;
};

export function parseDecision(raw: string): Decision | undefined {
  const value = raw.trim();
  return value === "APPROVE" || value === "REQUEST_CHANGES" ? value : undefined;
}

function checkMarker(body: string, expected: ReviewOutput["expected"]): string[] {
  const [first = ""] = body.split("\n");
  if (first.startsWith("\uFEFF")) return ["본문 첫 글자가 BOM(U+FEFF)이다. BOM 을 없애고 첫 줄을 표지로 시작해야 한다."];
  const found = parseMarker(first);
  if (found === undefined) {
    return [`본문 첫 줄이 표지가 아니다. 첫 줄은 정확히 \`<!-- yk-review head_sha=<40자 커밋> mode=<full|incremental> -->\` 여야 한다. 지금 첫 줄: ${first.slice(0, 80)}`];
  }
  const errors: string[] = [];
  if (found.headSha !== expected.headSha) errors.push(`표지의 head_sha 가 PR head 와 다르다. 기대 ${expected.headSha}, 표지 ${found.headSha}.`);
  if (found.mode !== expected.mode) errors.push(`표지의 mode 가 다르다. 기대 ${expected.mode}, 표지 ${found.mode}.`);
  return errors;
}

function checkDecision(body: string, decisionFile: string): string[] {
  const decision = parseDecision(decisionFile);
  if (decision === undefined) {
    return [`${OUT_FILES.decision} 는 APPROVE 또는 REQUEST_CHANGES 한 줄이어야 한다. 지금 내용: ${decisionFile.trim().slice(0, 40) || "(비어 있음)"}`];
  }
  const verdicts = [...body.matchAll(VERDICT)].map((m) => m[1]);
  const [only] = verdicts;
  if (only === undefined) return ["본문에 `**판정: APPROVE**` 또는 `**판정: REQUEST_CHANGES**` 판정 줄이 없다."];
  if (verdicts.length > 1) return [`본문에 판정 줄이 ${verdicts.length}개다. 정확히 한 개여야 한다.`];
  if (only !== decision) return [`본문의 판정(${only})과 ${OUT_FILES.decision}(${decision})이 다르다. 둘을 맞춰야 한다.`];
  return [];
}

function checkLength(body: string): string[] {
  if (body.length <= BODY_CAP) return [];
  return [`본문이 ${body.length}자라서 상한 ${BODY_CAP}자를 넘는다. ${OUT_DIR}/${OUT_FILES.review} 를 줄여 다시 쓰게 하거나(다시 실행) 직접 줄여라. 지적을 빼지 말고 설명을 줄인다.`];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type CommentsRead = { comments: ReviewComment[]; errors: string[] };

function readComments(raw: string | undefined): CommentsRead {
  if (raw === undefined) return { comments: [], errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { comments: [], errors: [`${OUT_FILES.comments} 가 JSON 이 아니다.`] };
  }
  if (!Array.isArray(parsed)) return { comments: [], errors: [`${OUT_FILES.comments} 는 배열이어야 한다.`] };
  const comments: ReviewComment[] = [];
  const errors: string[] = [];
  parsed.forEach((item: unknown, index) => {
    const label = `${OUT_FILES.comments}[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${label} 가 객체가 아니다.`);
      return;
    }
    const { path, line, body } = item;
    if (typeof path !== "string" || path === "") return void errors.push(`${label}.path 는 비어 있지 않은 문자열이어야 한다.`);
    if (typeof line !== "number" || !Number.isInteger(line) || line < 1) return void errors.push(`${label}.line 은 1 이상의 정수여야 한다.`);
    if (typeof body !== "string" || body.trim() === "") return void errors.push(`${label}.body 는 비어 있지 않은 문자열이어야 한다.`);
    comments.push({ path, line, body });
  });
  return { comments, errors };
}

function checkAddedLines(comments: ReviewComment[], addedLines: AddedLines): string[] {
  return comments.flatMap((c, index) =>
    addedLines.get(c.path)?.has(c.line) === true
      ? []
      : [`${OUT_FILES.comments}[${index}]: ${c.path}:${c.line} 는 이 PR 이 더하거나 바꾼 줄이 아니다. 코멘트를 바뀐 줄로 옮기거나 지운다.`],
  );
}

export type Validation = { ok: true; decision: Decision; comments: ReviewComment[] } | { ok: false; errors: string[] };

export function validateReview(output: ReviewOutput): Validation {
  const read = readComments(output.comments);
  const errors = [
    ...checkMarker(output.body, output.expected),
    ...checkDecision(output.body, output.decision),
    ...checkLength(output.body),
    ...read.errors,
    ...(read.errors.length === 0 ? checkAddedLines(read.comments, output.addedLines) : []),
  ];
  const decision = parseDecision(output.decision);
  return errors.length > 0 || decision === undefined ? { ok: false, errors } : { ok: true, decision, comments: read.comments };
}

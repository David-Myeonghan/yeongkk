import { describe, expect, it } from "vitest";
import { renderMarker } from "./marker";
import { BODY_CAP, validateReview, type ReviewOutput } from "./validate";

const SHA = "a".repeat(40);
const marker = (sha = SHA, mode: "full" | "incremental" = "full") => renderMarker(sha, mode);
const errorsOf = (output: ReviewOutput): string[] => {
  const result = validateReview(output);
  return result.ok ? [] : result.errors;
};
const body = (verdict = "APPROVE", m = marker()) => `${m}\n**판정: ${verdict}**\n\n> TL;DR: 문제 없다.\n`;

const good = (): ReviewOutput => ({
  expected: { headSha: SHA, mode: "full" },
  body: body(),
  decision: "APPROVE\n",
  comments: JSON.stringify([{ path: "a.ts", line: 3, body: "여기" }]),
  addedLines: new Map([["a.ts", new Set([3, 4])]]),
});

describe("validateReview", () => {
  it("좋은 출력은 통과한다", () => {
    expect(errorsOf(good())).toEqual([]);
  });

  it("통과하면 읽은 판정과 코멘트를 돌려준다", () => {
    expect(validateReview(good())).toEqual({ ok: true, decision: "APPROVE", comments: [{ path: "a.ts", line: 3, body: "여기" }] });
    expect(validateReview({ ...good(), comments: undefined })).toEqual({ ok: true, decision: "APPROVE", comments: [] });
  });

  it("틀리면 오류만 돌려준다", () => {
    const result = validateReview({ ...good(), decision: "MAYBE" });
    expect(result.ok).toBe(false);
  });

  it("comments.json 이 없어도 통과한다", () => {
    expect(errorsOf({ ...good(), comments: undefined })).toEqual([]);
  });

  it("표지가 없으면 막는다", () => {
    const errors = errorsOf({ ...good(), body: "**판정: APPROVE**\n내용" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("첫 줄");
  });

  it("표지가 첫 줄이 아니면 막는다", () => {
    const errors = errorsOf({ ...good(), body: `머리말\n${body()}` });
    expect(errors.join("\n")).toContain("첫 줄");
  });

  it("sha 가 다르면 막는다", () => {
    const errors = errorsOf({ ...good(), body: body("APPROVE", marker("b".repeat(40))) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("head_sha");
  });

  it("sha 가 40자 hex 가 아니면 막는다", () => {
    const errors = errorsOf({ ...good(), body: body("APPROVE", marker("abc123")) });
    expect(errors.join("\n")).toContain("첫 줄");
  });

  it("mode 가 다르면 막는다", () => {
    const errors = errorsOf({ ...good(), body: body("APPROVE", marker(SHA, "incremental")) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("mode");
  });

  it("decision.txt 가 쓰레기면 막는다", () => {
    const errors = errorsOf({ ...good(), decision: "approve it" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("decision.txt");
  });

  it("본문은 APPROVE 인데 파일은 REQUEST_CHANGES 면 막는다", () => {
    const errors = errorsOf({ ...good(), decision: "REQUEST_CHANGES" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("판정");
  });

  it("판정 줄이 둘이면 서로 달라도 같아도 막는다", () => {
    const differing = `${marker()}\n**판정: APPROVE**\n본문\n**판정: REQUEST_CHANGES**\n`;
    const agreeing = `${marker()}\n**판정: APPROVE**\n본문\n**판정: APPROVE**\n`;
    for (const b of [differing, agreeing]) {
      const errors = errorsOf({ ...good(), body: b });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("2개");
    }
  });

  it("CRLF 본문도 통과한다", () => {
    expect(errorsOf({ ...good(), body: body().replace(/\n/g, "\r\n") })).toEqual([]);
  });

  it("표지 앞의 BOM 은 막고 이유를 말한다", () => {
    const errors = errorsOf({ ...good(), body: `\uFEFF${body()}` });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("BOM");
  });

  it("판정 줄이 없으면 막는다", () => {
    const errors = errorsOf({ ...good(), body: `${marker()}\n내용만 있다\n` });
    expect(errors.join("\n")).toContain("판정 줄");
  });

  it("길이 상한을 넘으면 어떻게 할지 알려 준다", () => {
    const long = body() + "가".repeat(BODY_CAP);
    const errors = errorsOf({ ...good(), body: long });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String(BODY_CAP));
    expect(errors[0]).toContain("review.md");
  });

  it("상한 딱 그 길이는 통과한다", () => {
    const base = body();
    const exact = base + "가".repeat(BODY_CAP - base.length);
    expect(exact).toHaveLength(BODY_CAP);
    expect(errorsOf({ ...good(), body: exact })).toEqual([]);
  });

  it("이 PR 이 건드리지 않은 줄의 코멘트는 막는다", () => {
    const comments = JSON.stringify([{ path: "a.ts", line: 99, body: "x" }]);
    const errors = errorsOf({ ...good(), comments });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("a.ts:99");
  });

  it("diff 에 없는 파일의 코멘트는 막는다", () => {
    const comments = JSON.stringify([{ path: "z.ts", line: 3, body: "x" }]);
    expect(errorsOf({ ...good(), comments }).join("\n")).toContain("z.ts:3");
  });

  it.each([
    ["JSON 이 아님", "{not json"],
    ["배열이 아님", JSON.stringify({ path: "a.ts" })],
    ["줄이 0", JSON.stringify([{ path: "a.ts", line: 0, body: "x" }])],
    ["줄이 소수", JSON.stringify([{ path: "a.ts", line: 1.5, body: "x" }])],
    ["본문이 빈 문자열", JSON.stringify([{ path: "a.ts", line: 3, body: "" }])],
    ["path 가 숫자", JSON.stringify([{ path: 1, line: 3, body: "x" }])],
    ["항목이 null", JSON.stringify([null])],
  ])("comments.json 모양이 틀리면 막는다: %s", (_name, comments) => {
    const errors = errorsOf({ ...good(), comments });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("comments.json");
  });
});

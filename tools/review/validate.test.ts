import { describe, expect, it } from "vitest";
import { BODY_CAP, validateReview, type ReviewOutput } from "./validate";

const SHA = "a".repeat(40);
const marker = (sha = SHA, mode = "full") => `<!-- yk-review head_sha=${sha} mode=${mode} -->`;
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
    expect(validateReview(good())).toEqual([]);
  });

  it("comments.json 이 없어도 통과한다", () => {
    expect(validateReview({ ...good(), comments: undefined })).toEqual([]);
  });

  it("표지가 없으면 막는다", () => {
    const errors = validateReview({ ...good(), body: "**판정: APPROVE**\n내용" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("첫 줄");
  });

  it("표지가 첫 줄이 아니면 막는다", () => {
    const errors = validateReview({ ...good(), body: `머리말\n${body()}` });
    expect(errors.join("\n")).toContain("첫 줄");
  });

  it("sha 가 다르면 막는다", () => {
    const errors = validateReview({ ...good(), body: body("APPROVE", marker("b".repeat(40))) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("head_sha");
  });

  it("sha 가 40자 hex 가 아니면 막는다", () => {
    const errors = validateReview({ ...good(), body: body("APPROVE", marker("abc123")) });
    expect(errors.join("\n")).toContain("첫 줄");
  });

  it("mode 가 다르면 막는다", () => {
    const errors = validateReview({ ...good(), body: body("APPROVE", marker(SHA, "incremental")) });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("mode");
  });

  it("decision.txt 가 쓰레기면 막는다", () => {
    const errors = validateReview({ ...good(), decision: "approve it" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("decision.txt");
  });

  it("본문은 APPROVE 인데 파일은 REQUEST_CHANGES 면 막는다", () => {
    const errors = validateReview({ ...good(), decision: "REQUEST_CHANGES" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("판정");
  });

  it("판정 줄이 없으면 막는다", () => {
    const errors = validateReview({ ...good(), body: `${marker()}\n내용만 있다\n` });
    expect(errors.join("\n")).toContain("판정 줄");
  });

  it("길이 상한을 넘으면 어떻게 할지 알려 준다", () => {
    const long = body() + "가".repeat(BODY_CAP);
    const errors = validateReview({ ...good(), body: long });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(String(BODY_CAP));
    expect(errors[0]).toContain("review.md");
  });

  it("상한 딱 그 길이는 통과한다", () => {
    const base = body();
    const exact = base + "가".repeat(BODY_CAP - base.length);
    expect(exact).toHaveLength(BODY_CAP);
    expect(validateReview({ ...good(), body: exact })).toEqual([]);
  });

  it("이 PR 이 건드리지 않은 줄의 코멘트는 막는다", () => {
    const comments = JSON.stringify([{ path: "a.ts", line: 99, body: "x" }]);
    const errors = validateReview({ ...good(), comments });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("a.ts:99");
  });

  it("diff 에 없는 파일의 코멘트는 막는다", () => {
    const comments = JSON.stringify([{ path: "z.ts", line: 3, body: "x" }]);
    expect(validateReview({ ...good(), comments }).join("\n")).toContain("z.ts:3");
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
    const errors = validateReview({ ...good(), comments });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("comments.json");
  });
});

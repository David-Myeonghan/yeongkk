import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarker } from "./marker";
import { buildReviewPayload, OWN_PR_NOTE, submitReview } from "./submit";
import type { Run } from "./types";

const SHA = "c".repeat(40);
const BODY = `${renderMarker(SHA, "full")}\n**판정: REQUEST_CHANGES**\n\n> TL;DR: 고칠 것이 있다.\n`;
const comments = [{ path: "a.ts", line: 3, body: "여기" }];

describe("buildReviewPayload", () => {
  it("남의 PR 이면 판정이 곧 GitHub 리뷰 종류다", () => {
    const p = buildReviewPayload({ headSha: SHA, body: BODY, decision: "REQUEST_CHANGES", comments, authorLogin: "alice", viewerLogin: "bob" });
    expect(p.event).toBe("REQUEST_CHANGES");
    expect(p.body).toBe(BODY);
    expect(p.commit_id).toBe(SHA);
  });

  it("남의 PR 에서 APPROVE 도 그대로 간다", () => {
    const p = buildReviewPayload({ headSha: SHA, body: BODY, decision: "APPROVE", comments: [], authorLogin: "alice", viewerLogin: "bob" });
    expect(p.event).toBe("APPROVE");
  });

  it("내 PR 이면 COMMENT 이고 표지 바로 아래에 안내 한 줄이 들어간다", () => {
    const p = buildReviewPayload({ headSha: SHA, body: BODY, decision: "REQUEST_CHANGES", comments, authorLogin: "bob", viewerLogin: "bob" });
    expect(p.event).toBe("COMMENT");
    expect(OWN_PR_NOTE).toBe("> 내 PR이라 GitHub 리뷰 종류는 COMMENT 다. 판정은 아래 줄이 기준이다.");
    const lines = p.body.split("\n");
    expect(lines[0]).toBe(renderMarker(SHA, "full"));
    expect(lines[1]).toBe(OWN_PR_NOTE);
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("**판정: REQUEST_CHANGES**");
  });

  it("코멘트는 side RIGHT 로 옮긴다", () => {
    const p = buildReviewPayload({ headSha: SHA, body: BODY, decision: "APPROVE", comments, authorLogin: "a", viewerLogin: "b" });
    expect(p.comments).toEqual([{ path: "a.ts", line: 3, side: "RIGHT", body: "여기" }]);
  });
});

describe("submitReview", () => {
  it("gh api 로 리뷰 만들기 주소에 파일을 넘기고 주소를 돌려준다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-submit-"));
    const file = join(dir, "payload.json");
    const calls: Array<[string, string[]]> = [];
    const run: Run = (cmd, args) => {
      calls.push([cmd, args]);
      return { code: 0, stdout: JSON.stringify({ html_url: "https://example.test/r/1" }), stderr: "" };
    };
    const payload = buildReviewPayload({ headSha: SHA, body: BODY, decision: "APPROVE", comments: [], authorLogin: "a", viewerLogin: "b" });
    const result = submitReview(payload, 7, file, run);
    expect(result).toEqual({ ok: true, url: "https://example.test/r/1" });
    expect(calls).toHaveLength(1);
    const [cmd, args] = calls[0] ?? ["", []];
    expect(cmd).toBe("gh");
    expect(args).toEqual(["api", "-X", "POST", "repos/{owner}/{repo}/pulls/7/reviews", "--input", file]);
    expect(JSON.parse(readFileSync(file, "utf8")).commit_id).toBe(SHA);
  });

  it("gh 가 실패하면 이유를 돌려준다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-submit-"));
    const run: Run = () => ({ code: 1, stdout: "", stderr: "422 Unprocessable" });
    const payload = buildReviewPayload({ headSha: SHA, body: BODY, decision: "APPROVE", comments: [], authorLogin: "a", viewerLogin: "b" });
    const result = submitReview(payload, 7, join(dir, "p.json"), run);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("422");
  });
});

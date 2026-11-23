import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_DIR, CONTEXT_FILES, buildContext, newCommitsRange, parseNumstat, parsePrMeta, parseReviews,
  pickPreviousReview, renderChangedFiles, renderPr,
} from "./context";
import type { PrMeta, Run } from "./types";

const SHA = "1".repeat(40);
const meta: PrMeta = { number: 5, title: "제목", body: "본문", authorLogin: "alice", baseRefName: "main", headRefName: "feat", headSha: SHA };

const fakeRun = (calls: string[][] = []): Run => (cmd, args) => {
  calls.push([cmd, ...args]);
  if (args.includes("--numstat")) return { code: 0, stdout: "3\t1\tsrc/a.ts\n-\t-\timg.png\n", stderr: "" };
  return { code: 0, stdout: "diff --git a/src/a.ts b/src/a.ts\n", stderr: "" };
};

describe("renderPr", () => {
  it("제목 · 번호 · 작성자 · base · head sha · 본문을 담는다", () => {
    const md = renderPr(meta, "origin/main");
    for (const s of ["제목", "#5", "alice", "origin/main", SHA, "본문"]) expect(md).toContain(s);
  });
});

describe("numstat", () => {
  it("경로 · 추가 · 삭제를 읽고 바이너리는 0 으로 둔다", () => {
    expect(parseNumstat("3\t1\tsrc/a.ts\n-\t-\timg.png\n")).toEqual([
      { path: "src/a.ts", added: 3, deleted: 1 },
      { path: "img.png", added: 0, deleted: 0 },
    ]);
  });

  it("changed-files 에 한 줄씩 적는다", () => {
    expect(renderChangedFiles([{ path: "a.ts", added: 3, deleted: 1 }])).toBe("a.ts\t+3\t-1\n");
  });
});

describe("buildContext", () => {
  it("자료 파일을 모두 만들고 지침 두 개를 복사한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-ctx-"));
    const result = buildContext({ run: fakeRun(), dir, meta, base: "origin/main", mode: "full", diagnostics: "# 진단\n", docsDir: import.meta.dirname });
    expect(result).toEqual({ ok: true });
    const out = join(dir, CONTEXT_DIR);
    for (const name of [CONTEXT_FILES.pr, CONTEXT_FILES.diff, CONTEXT_FILES.changedFiles, CONTEXT_FILES.diagnostics, CONTEXT_FILES.adversarial, CONTEXT_FILES.outputRules]) {
      expect(existsSync(join(out, name)), name).toBe(true);
    }
    expect(existsSync(join(out, CONTEXT_FILES.previousReview))).toBe(false);
    expect(readFileSync(join(out, CONTEXT_FILES.changedFiles), "utf8")).toBe("src/a.ts\t+3\t-1\nimg.png\t+0\t-0\n");
    expect(readFileSync(join(out, CONTEXT_FILES.adversarial), "utf8")).toBe(readFileSync(join(import.meta.dirname, "adversarial.md"), "utf8"));
  });

  it("package-lock.json 을 patch 에서 뺀다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-ctx-"));
    const calls: string[][] = [];
    buildContext({ run: fakeRun(calls), dir, meta, base: "origin/main", mode: "full", diagnostics: "", docsDir: import.meta.dirname });
    const diffCalls = calls.filter((c) => c[1] === "diff");
    expect(diffCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of diffCalls) {
      expect(c).toContain(`origin/main...${SHA}`);
      expect(c).toContain(":(exclude,glob)**/package-lock.json");
    }
  });

  it("증분 모드에 지난 리뷰가 없으면 이유를 돌려준다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-ctx-"));
    const result = buildContext({ run: fakeRun(), dir, meta, base: "origin/main", mode: "incremental", diagnostics: "", docsDir: import.meta.dirname });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("지난 리뷰");
  });

  it("증분 모드에 지난 리뷰가 있으면 previous-review.md 를 쓴다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-ctx-"));
    const previous = { body: "지난 본문", headSha: "2".repeat(40), url: "u" };
    const result = buildContext({ run: fakeRun(), dir, meta, base: "origin/main", mode: "incremental", previous, diagnostics: "", docsDir: import.meta.dirname });
    expect(result).toEqual({ ok: true });
    expect(readFileSync(join(dir, CONTEXT_DIR, CONTEXT_FILES.previousReview), "utf8")).toBe("지난 본문");
  });

  it("git diff 가 실패하면 이유를 돌려준다", () => {
    const dir = mkdtempSync(join(tmpdir(), "yk-ctx-"));
    const run: Run = () => ({ code: 128, stdout: "", stderr: "bad revision" });
    const result = buildContext({ run, dir, meta, base: "origin/nope", mode: "full", diagnostics: "", docsDir: import.meta.dirname });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("bad revision");
  });
});

describe("증분 보조", () => {
  const marker = (sha: string) => `<!-- yk-review head_sha=${sha} mode=full -->\n**판정: APPROVE**`;
  const rows = [
    { user: "me", body: marker("a".repeat(40)), html_url: "u1" },
    { user: "other", body: marker("b".repeat(40)), html_url: "u2" },
    { user: "me", body: "그냥 코멘트", html_url: "u3" },
    { user: "me", body: marker("c".repeat(40)), html_url: "u4" },
  ];
  const ndjson = rows.map((r) => JSON.stringify(r)).join("\n");

  it("내가 쓴 표지 있는 리뷰 중 가장 마지막을 고른다", () => {
    expect(pickPreviousReview(parseReviews(ndjson), "me")).toEqual({ body: marker("c".repeat(40)), headSha: "c".repeat(40), url: "u4" });
  });

  it("없으면 undefined", () => {
    expect(pickPreviousReview(parseReviews(ndjson), "nobody")).toBeUndefined();
  });

  it("새 커밋 범위는 지난 sha 와 지금 sha 다", () => {
    expect(newCommitsRange("a".repeat(40), SHA)).toEqual({ from: "a".repeat(40), to: SHA });
  });
});

describe("parsePrMeta", () => {
  it("gh pr view 의 JSON 을 읽는다", () => {
    const json = JSON.stringify({ number: 5, title: "t", body: "b", author: { login: "alice" }, baseRefName: "main", headRefName: "f", headRefOid: SHA });
    expect(parsePrMeta(json)).toEqual({ ok: true, meta: { number: 5, title: "t", body: "b", authorLogin: "alice", baseRefName: "main", headRefName: "f", headSha: SHA } });
  });

  it("필드가 빠졌으면 어느 것인지 말한다", () => {
    const r = parsePrMeta(JSON.stringify({ number: 5 }));
    expect(r.ok).toBe(false);
  });

  it("JSON 이 아니면 실패한다", () => {
    expect(parsePrMeta("nope").ok).toBe(false);
  });
});

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt";
import { main, parseArgs } from "./run";
import type { Run } from "./types";

const SHA = "f".repeat(40);
const PREV = "9".repeat(40);
const marker = (sha: string, mode: string) => `<!-- yk-review head_sha=${sha} mode=${mode} -->`;
const REVIEW = (sha = SHA, mode = "full") => `${marker(sha, mode)}\n**판정: REQUEST_CHANGES**\n\n> TL;DR: 고칠 것.\n`;

type World = {
  cwd: string;
  calls: string[];
  out: string[];
  err: string[];
  localHead: string;
  author: string;
  viewer: string;
  missing: string[];
  review: string;
  decision: string;
  comments?: string;
  reviews: string;
  reviewsFail: boolean;
  silentReviewer: boolean;
  cross: boolean;
  baseMissing: boolean;
  prevExists: boolean;
  prevIsAncestor: boolean;
  status: string;
  reviewerDirties: string;
  inputs: string[];
  reviewerArgs: string[];
};

function setup(over: Partial<World> = {}) {
  const w: World = {
    cwd: mkdtempSync(join(tmpdir(), "yk-run-")), calls: [], out: [], err: [], localHead: SHA, author: "alice", viewer: "alice",
    missing: [], review: REVIEW(), decision: "REQUEST_CHANGES\n", reviews: "", reviewsFail: false, silentReviewer: false, cross: false, baseMissing: false, prevExists: true, prevIsAncestor: true,
    status: "", reviewerDirties: "", inputs: [], reviewerArgs: [], ...over,
  };
  const run: Run = (cmd, args, options) => {
    const line = [cmd, ...args].join(" ");
    w.calls.push(line);
    const ok = (stdout = "") => ({ code: 0, stdout, stderr: "" });
    if (cmd === "which") return w.missing.includes(args[0] ?? "") ? { code: 1, stdout: "", stderr: "" } : ok("/bin/x");
    if (line.startsWith("gh pr view")) {
      return ok(JSON.stringify({ number: 7, title: "t", body: "b", author: { login: w.author }, baseRefName: "main", headRefName: "f", headRefOid: SHA, isCrossRepository: w.cross }));
    }
    if (line === "git rev-parse HEAD") return ok(`${w.localHead}\n`);
    if (line.startsWith("git rev-parse --verify")) return w.baseMissing ? { code: 128, stdout: "", stderr: "unknown revision" } : ok(`${"7".repeat(40)}\n`);
    if (line.startsWith("git cat-file")) return w.prevExists ? ok() : { code: 1, stdout: "", stderr: "" };
    if (line.startsWith("git merge-base --is-ancestor")) return { code: w.prevIsAncestor ? 0 : 1, stdout: "", stderr: "" };
    if (line === "git status --porcelain") return ok(w.status);
    if (line === "gh api user --jq .login") return ok(`${w.viewer}\n`);
    if (line.includes("pulls/7/reviews") && args.includes("--paginate")) {
      return w.reviewsFail ? { code: 1, stdout: "", stderr: "API rate limit exceeded" } : ok(w.reviews);
    }
    if (line.includes("pulls/7/reviews") && args.includes("POST")) return ok(JSON.stringify({ html_url: "https://example.test/review/1" }));
    if (cmd === "git" && args.includes("diff") && args.includes("--numstat")) return ok("1\t0\ta.ts\n");
    if (cmd === "git" && args.includes("diff") && args.includes("-U0")) return ok("diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -0,0 +1,5 @@\n+1\n+2\n+3\n+4\n+5\n");
    if (cmd === "git" && args.includes("diff")) return ok("diff --git a/a.ts b/a.ts\n");
    if (cmd === "npm") return ok("pass");
    if (cmd === "claude") {
      w.inputs.push(options?.input ?? "");
      w.reviewerArgs = args;
      w.status += w.reviewerDirties;
      if (!w.silentReviewer) {
        const outDir = join(w.cwd, "review-out");
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, "review.md"), w.review);
        writeFileSync(join(outDir, "decision.txt"), w.decision);
        if (w.comments !== undefined) writeFileSync(join(outDir, "comments.json"), w.comments);
      }
      return ok('{"type":"result"}\n');
    }
    return { code: 127, stdout: "", stderr: `예상 밖 호출: ${line}` };
  };
  const exec = (argv: string[]) => main(argv, { run, cwd: w.cwd, log: (s) => w.out.push(s), error: (s) => w.err.push(s) });
  return { w, exec };
}

const reviewerCalls = (w: World) => w.calls.filter((c) => c.startsWith("claude"));
const postCalls = (w: World) => w.calls.filter((c) => c.includes("pulls/7/reviews") && c.includes("POST"));

describe("parseArgs", () => {
  it("번호와 옵션을 읽는다", () => {
    expect(parseArgs(["7", "--base", "feat/x", "--incremental", "--submit"])).toEqual({ ok: true, args: { pr: 7, base: "feat/x", incremental: true, submit: true, allowFork: false } });
    expect(parseArgs(["7", "--allow-fork"])).toEqual({ ok: true, args: { pr: 7, base: undefined, incremental: false, submit: false, allowFork: true } });
  });
  it("번호가 없으면 실패한다", () => {
    expect(parseArgs([]).ok).toBe(false);
  });
  it("모르는 옵션은 실패한다", () => {
    expect(parseArgs(["7", "--force"]).ok).toBe(false);
  });
  it("--base 값이 없으면 실패한다", () => {
    expect(parseArgs(["7", "--base"]).ok).toBe(false);
  });
});

describe("main", () => {
  it("인자가 없으면 사용법을 한국어로 보이고 아무것도 띄우지 않는다", () => {
    const { w, exec } = setup();
    expect(exec([])).not.toBe(0);
    expect(w.err.join("\n")).toContain("사용법");
    expect(w.calls).toEqual([]);
  });

  it("필요한 도구가 없으면 어느 것인지 말한다", () => {
    const { w, exec } = setup({ missing: ["gh"] });
    expect(exec(["7"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("gh");
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("로컬 HEAD 가 PR head 와 다르면 체크아웃 안내를 하고 리뷰어를 띄우지 않는다", () => {
    const { w, exec } = setup({ localHead: "0".repeat(40) });
    expect(exec(["7"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("체크아웃");
    expect(reviewerCalls(w)).toEqual([]);
    expect(existsSync(join(w.cwd, "review-context"))).toBe(false);
  });

  it("검증을 통과하면 판정과 본문 경로를 보이고, 기본은 게시하지 않는다", () => {
    const { w, exec } = setup();
    expect(exec(["7"])).toBe(0);
    expect(w.out.join("\n")).toContain("REQUEST_CHANGES");
    expect(w.out.join("\n")).toContain(join("review-out", "review.md"));
    expect(postCalls(w)).toEqual([]);
    expect(readFileSync(join(w.cwd, "review-out", "execution.jsonl"), "utf8")).toContain("result");
  });

  it("리뷰어는 프롬프트를 인자가 아니라 STDIN 으로 받는다", () => {
    const { w, exec } = setup();
    exec(["7"]);
    const [call] = reviewerCalls(w);
    expect(call).toBe("claude -p --permission-mode acceptEdits --allowedTools Bash,Read,Grep,Glob,Write --output-format stream-json --verbose");
    const guide = readFileSync(join(import.meta.dirname, "guide.md"), "utf8");
    const expected = buildPrompt({ guide, prNumber: 7, headSha: SHA, mode: "full" });
    expect(w.inputs).toEqual([expected]);
    expect(w.reviewerArgs.join(" ")).not.toContain("yk-review");
    expect(w.reviewerArgs.join(" ")).not.toContain("판정");
  });

  it("base 기본값은 origin/<baseRefName>, --base 가 우선한다", () => {
    const a = setup();
    a.exec(["7"]);
    expect(a.w.calls.some((c) => c.startsWith("git") && c.includes(" diff ") && c.includes(`origin/main...${SHA}`))).toBe(true);
    const b = setup();
    b.exec(["7", "--base", "feat/prev"]);
    expect(b.w.calls.some((c) => c.startsWith("git") && c.includes(" diff ") && c.includes(`feat/prev...${SHA}`))).toBe(true);
  });

  it("리뷰어 출력이 틀리면 0 이 아니게 끝나고 검증 메시지를 보인다", () => {
    const { w, exec } = setup({ decision: "REQUEST_CHANGES", review: REVIEW("0".repeat(40)) });
    expect(exec(["7", "--submit"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("head_sha");
    expect(postCalls(w)).toEqual([]);
  });

  it("리뷰어가 파일을 안 썼으면 알려 준다", () => {
    const { w, exec } = setup({ silentReviewer: true });
    expect(exec(["7"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("review.md");
  });

  it("내 PR 에 --submit 하면 COMMENT 로 게시한다", () => {
    const { w, exec } = setup({ comments: JSON.stringify([{ path: "a.ts", line: 2, body: "여기" }]) });
    expect(exec(["7", "--submit"])).toBe(0);
    expect(postCalls(w)).toHaveLength(1);
    expect(w.out.join("\n")).toContain("https://example.test/review/1");
    const payload = JSON.parse(readFileSync(join(w.cwd, "review-out", "payload.json"), "utf8"));
    expect(payload.event).toBe("COMMENT");
    expect(payload.commit_id).toBe(SHA);
    expect(payload.body).toContain("**판정: REQUEST_CHANGES**");
    expect(payload.comments).toEqual([{ path: "a.ts", line: 2, side: "RIGHT", body: "여기" }]);
  });

  it("남의 PR 이면 판정이 그대로 이벤트다", () => {
    const { w, exec } = setup({ viewer: "bob" });
    expect(exec(["7", "--submit"])).toBe(0);
    const payload = JSON.parse(readFileSync(join(w.cwd, "review-out", "payload.json"), "utf8"));
    expect(payload.event).toBe("REQUEST_CHANGES");
  });

  it("이전 실행의 출력 파일은 지워지므로 검증되지 않는다", () => {
    const { w, exec } = setup({ silentReviewer: true });
    mkdirSync(join(w.cwd, "review-out"), { recursive: true });
    writeFileSync(join(w.cwd, "review-out", "review.md"), REVIEW("0".repeat(40)));
    writeFileSync(join(w.cwd, "review-out", "decision.txt"), "REQUEST_CHANGES\n");
    expect(exec(["7"])).not.toBe(0);
    expect(existsSync(join(w.cwd, "review-out", "review.md"))).toBe(false);
    expect(w.err.join("\n")).toContain("review.md");
  });

  it("base ref 를 풀 수 없으면 검사를 돌리기 전에 멈춘다", () => {
    const { w, exec } = setup({ baseMissing: true });
    expect(exec(["7"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("--base");
    expect(w.calls.some((c) => c.startsWith("npm"))).toBe(false);
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("pr.md 에 실제로 쓴 비교 기준이 적힌다", () => {
    const { w, exec } = setup();
    exec(["7", "--base", "feat/prev"]);
    expect(readFileSync(join(w.cwd, "review-context", "pr.md"), "utf8")).toContain(`비교 기준: feat/prev (${"7".repeat(40)})`);
  });
});

describe("포크 PR", () => {
  it("기본은 아무것도 돌리기 전에 거절한다", () => {
    const { w, exec } = setup({ cross: true });
    expect(exec(["7"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("--allow-fork");
    expect(w.calls.some((c) => c.startsWith("npm") || c.startsWith("claude") || c.startsWith("git"))).toBe(false);
  });

  it("--allow-fork 를 주면 이어 간다", () => {
    const { w, exec } = setup({ cross: true });
    expect(exec(["7", "--allow-fork"])).toBe(0);
    expect(reviewerCalls(w)).toHaveLength(1);
  });
});

describe("작업 트리", () => {
  it("시작할 때 커밋 안 된 변경이 있으면 경로를 알리고 아무것도 띄우지 않고 쓰지 않는다", () => {
    const { w, exec } = setup({ status: " M a.ts\n?? b.ts\n" });
    expect(exec(["7", "--submit"])).not.toBe(0);
    const err = w.err.join("\n");
    expect(err).toContain("a.ts");
    expect(err).toContain("b.ts");
    expect(err).toContain("커밋");
    expect(w.calls.some((c) => c.startsWith("npm") || c.startsWith("claude"))).toBe(false);
    expect(postCalls(w)).toEqual([]);
    expect(existsSync(join(w.cwd, "review-context"))).toBe(false);
    expect(existsSync(join(w.cwd, "review-out"))).toBe(false);
  });

  it("깨끗하게 시작해 깨끗하게 끝나면 통과한다", () => {
    const { exec } = setup();
    expect(exec(["7"])).toBe(0);
  });

  it("바뀌었으면 경로를 알리고 게시하지 않고 0 이 아니게 끝난다", () => {
    const { w, exec } = setup({ reviewerDirties: "?? tools/evil.ts\n" });
    expect(exec(["7", "--submit"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("tools/evil.ts");
    expect(postCalls(w)).toEqual([]);
  });
});

describe("--incremental", () => {
  const row = (user: string, sha: string, url: string) => JSON.stringify({ user, body: `${marker(sha, "full")}\n**판정: REQUEST_CHANGES**`, html_url: url });

  it("지난 리뷰가 없으면 말하고 0 이 아니게 끝난다", () => {
    const { w, exec } = setup();
    expect(exec(["7", "--incremental"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("지난 리뷰");
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("지난 리뷰 조회가 gh 오류로 실패하면 없다고 하지 않고 stderr 를 보인다", () => {
    const { w, exec } = setup({ reviewsFail: true });
    expect(exec(["7", "--incremental"])).not.toBe(0);
    const err = w.err.join("\n");
    expect(err).toContain("지난 리뷰를 읽지 못했다");
    expect(err).toContain("API rate limit exceeded");
    expect(err).not.toContain("--incremental 없이");
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("지난 리뷰의 head 가 지금 head 와 같으면 새 커밋이 없다고 멈춘다", () => {
    const { w, exec } = setup({ reviews: row("alice", SHA, "u") });
    expect(exec(["7", "--incremental"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("새 커밋이 없다");
    expect(w.calls.some((c) => c.startsWith("npm"))).toBe(false);
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("지난 리뷰가 있으면 previous-review.md 를 쓰고 증분으로 돈다", () => {
    const { w, exec } = setup({ reviews: row("alice", PREV, "u"), review: REVIEW(SHA, "incremental") });
    expect(exec(["7", "--incremental"])).toBe(0);
    expect(readFileSync(join(w.cwd, "review-context", "previous-review.md"), "utf8")).toContain(marker(PREV, "full"));
    expect(w.calls.some((c) => c.includes(`merge-base --is-ancestor ${PREV} ${SHA}`))).toBe(true);
  });

  it("내 리뷰가 여럿이면 가장 마지막 것이 이기고 남의 리뷰는 무시한다", () => {
    const older = "1".repeat(40);
    const newest = "2".repeat(40);
    const reviews = [row("alice", older, "u1"), row("alice", newest, "u2"), row("mallory", "3".repeat(40), "u3")].join("\n");
    const { w, exec } = setup({ reviews, review: REVIEW(SHA, "incremental") });
    expect(exec(["7", "--incremental"])).toBe(0);
    const prev = readFileSync(join(w.cwd, "review-context", "previous-review.md"), "utf8");
    expect(prev).toContain(newest);
    expect(prev).not.toContain(older);
    expect(w.calls.some((c) => c.includes(`--is-ancestor ${newest} ${SHA}`))).toBe(true);
  });

  it("지난 head 가 head 의 조상이 아니면 브랜치가 다시 쓰였다고 알리고 리뷰어를 띄우지 않는다", () => {
    const { w, exec } = setup({ reviews: row("alice", PREV, "u"), prevIsAncestor: false });
    expect(exec(["7", "--incremental"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("다시 쓰였");
    expect(w.err.join("\n")).toContain("--incremental 없이");
    expect(w.calls.some((c) => c.startsWith("npm"))).toBe(false);
    expect(reviewerCalls(w)).toEqual([]);
  });

  it("지난 head 객체가 로컬에 없어도 같은 안내를 한다", () => {
    const { w, exec } = setup({ reviews: row("alice", PREV, "u"), prevExists: false });
    expect(exec(["7", "--incremental"])).not.toBe(0);
    expect(w.err.join("\n")).toContain("다시 쓰였");
    expect(reviewerCalls(w)).toEqual([]);
  });
});

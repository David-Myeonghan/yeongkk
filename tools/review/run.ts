import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAddedLines } from "./added-lines";
import {
  CONTEXT_DIR, buildContext, diffArgs, parsePrMeta, parseReviews, pickPreviousReview,
} from "./context";
import { runDiagnostics } from "./diagnostics";
import { buildPrompt } from "./prompt";
import { buildReviewPayload, submitReview } from "./submit";
import type { PreviousReview, Run } from "./types";
import { OUT_DIR, OUT_FILES, parseComments, parseDecision, validateReview } from "./validate";

export const USAGE = [
  "사용법: npm run review -- <PR 번호> [--base <git ref>] [--incremental] [--submit] [--allow-fork]",
  "",
  "  --base <ref>    이 ref 와 비교한 변경만 리뷰한다. 쌓인 PR 이면 앞 PR 의 브랜치를 준다.",
  "                  주지 않으면 origin/<PR 의 base 브랜치> 를 쓴다.",
  "  --incremental   내 지난 리뷰 이후의 새 커밋만 본다. 지난 리뷰가 없으면 멈춘다.",
  "  --submit        리뷰를 GitHub 에 게시한다. 주지 않으면 파일만 만들고 멈춘다(드라이 런).",
  "  --allow-fork    포크에서 온 PR 도 리뷰한다. PR 의 코드와 글이 이 컴퓨터에서 내 로그인으로 실행되고 읽힌다.",
].join("\n");

const REQUIRED_TOOLS = ["claude", "gh", "git"] as const;
const REVIEWER_ARGS = ["-p", "--permission-mode", "acceptEdits", "--allowedTools", "Bash,Read,Grep,Glob,Write", "--output-format", "stream-json", "--verbose"];

export type Args = { pr: number; base: string | undefined; incremental: boolean; submit: boolean; allowFork: boolean };
export type ArgsResult = { ok: true; args: Args } | { ok: false; error: string };

export function parseArgs(argv: string[]): ArgsResult {
  let pr: number | undefined;
  let base: string | undefined;
  let incremental = false;
  let submit = false;
  let allowFork = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--incremental") incremental = true;
    else if (arg === "--submit") submit = true;
    else if (arg === "--allow-fork") allowFork = true;
    else if (arg === "--base") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, error: "--base 뒤에 git ref 가 필요하다." };
      base = value;
      i += 1;
    } else if (/^[1-9]\d*$/.test(arg) && pr === undefined) pr = Number(arg);
    else return { ok: false, error: `알 수 없는 인자: ${arg}` };
  }
  if (pr === undefined) return { ok: false, error: "PR 번호가 필요하다." };
  return { ok: true, args: { pr, base, incremental, submit, allowFork } };
}

export type Deps = { run: Run; cwd: string; log: (line: string) => void; error: (line: string) => void };

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

type PreviousLookup = { ok: true; review: PreviousReview | undefined } | { ok: false; error: string };

function fetchPreviousReview(deps: Deps, pr: number, viewer: string): PreviousLookup {
  const jq = ".[] | {user: .user.login, body: .body, html_url: .html_url}";
  const result = deps.run("gh", ["api", `repos/{owner}/{repo}/pulls/${pr}/reviews`, "--paginate", "--jq", jq]);
  if (result.code !== 0) return { ok: false, error: `지난 리뷰를 읽지 못했다: ${result.stderr.trim()}` };
  return { ok: true, review: pickPreviousReview(parseReviews(result.stdout), viewer) };
}

function viewerLogin(deps: Deps): string | undefined {
  const result = deps.run("gh", ["api", "user", "--jq", ".login"]);
  const login = result.stdout.trim();
  return result.code === 0 && login !== "" ? login : undefined;
}

export function main(argv: string[], deps: Deps): number {
  const fail = (message: string, code = 1): number => {
    deps.error(message);
    return code;
  };
  const parsed = parseArgs(argv);
  if (!parsed.ok) return fail(`${parsed.error}\n\n${USAGE}`, 2);
  const { pr, incremental, submit } = parsed.args;
  const { run, cwd } = deps;

  const missing = REQUIRED_TOOLS.filter((tool) => run("which", [tool]).code !== 0);
  if (missing.length > 0) return fail(`필요한 도구를 PATH 에서 찾지 못했다: ${missing.join(", ")}. 설치하고 로그인한 뒤 다시 실행한다.`);

  const view = run("gh", ["pr", "view", String(pr), "--json", "number,title,body,author,baseRefName,headRefName,headRefOid,isCrossRepository"]);
  if (view.code !== 0) return fail(`PR #${pr} 를 읽지 못했다: ${view.stderr.trim()}`);
  const metaResult = parsePrMeta(view.stdout);
  if (!metaResult.ok) return fail(metaResult.error);
  const meta = metaResult.meta;
  if (meta.isCrossRepository && !parsed.args.allowFork) {
    return fail(`PR #${pr} 는 포크에서 온 PR 이다. 리뷰하면 PR 의 코드(검사 단계)와 글(리뷰어 세션)이 이 컴퓨터에서 내 gh · claude 로그인으로 실행되고 읽힌다. 믿을 수 있는 작성자의 PR 일 때만 --allow-fork 를 붙여 다시 실행한다.`);
  }

  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  if (head !== meta.headSha) {
    return fail(`로컬 HEAD(${head.slice(0, 12)})가 PR #${pr} 의 head(${meta.headSha.slice(0, 12)})와 다르다. PR 브랜치(${meta.headRefName})를 체크아웃하고 최신으로 받은 뒤 다시 실행한다.`);
  }
  const dirty = run("git", ["status", "--porcelain"]);
  if (dirty.code !== 0) return fail(`git status 에 실패했다: ${dirty.stderr.trim()}`);
  if (dirty.stdout.trim() !== "") {
    return fail(`커밋 안 된 변경이 있다. 검사와 리뷰어는 작업 트리를 읽는데 게시는 head 커밋의 리뷰로 올라가므로, 먼저 커밋하거나 버린 뒤 다시 실행한다:\n${dirty.stdout.trimEnd()}`);
  }
  const base = parsed.args.base ?? `origin/${meta.baseRefName}`;
  const baseResult = run("git", ["rev-parse", "--verify", `${base}^{commit}`]);
  const baseSha = baseResult.stdout.trim();
  if (baseResult.code !== 0 || baseSha === "") {
    return fail(`비교 기준 ${base} 를 찾지 못했다. git fetch 로 받거나 --base <git ref> 로 기준을 직접 준다.`);
  }

  const needsViewer = incremental || submit;
  const viewer = needsViewer ? viewerLogin(deps) : undefined;
  if (needsViewer && viewer === undefined) return fail("gh 로그인 계정을 알아내지 못했다. `gh auth status` 를 확인한다.");

  let previous: PreviousReview | undefined;
  if (incremental && viewer !== undefined) {
    const lookup = fetchPreviousReview(deps, pr, viewer);
    if (!lookup.ok) return fail(lookup.error);
    previous = lookup.review;
    if (previous === undefined) return fail(`증분 리뷰를 할 수 없다. PR #${pr} 에 ${viewer} 가 올린 yk-review 표지의 지난 리뷰가 없다. --incremental 없이 실행한다.`);
    if (previous.headSha === meta.headSha) return fail(`지난 리뷰의 head 가 지금 head(${meta.headSha.slice(0, 12)})와 같다. 새 커밋이 없다.`);
    const exists = run("git", ["cat-file", "-e", `${previous.headSha}^{commit}`]).code === 0;
    const ancestor = exists && run("git", ["merge-base", "--is-ancestor", previous.headSha, meta.headSha]).code === 0;
    if (!ancestor) {
      return fail(`지난 리뷰의 head(${previous.headSha.slice(0, 12)})가 지금 head 의 조상이 아니거나 로컬에 없다. 지난 리뷰 뒤로 브랜치가 다시 쓰였다. --incremental 없이 전체 리뷰를 돌린다.`);
    }
  }

  const contextDir = join(cwd, CONTEXT_DIR);
  const outDir = join(cwd, OUT_DIR);
  rmSync(contextDir, { recursive: true, force: true });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  deps.log("검사를 돌리는 중(lint · 타입 · 테스트)...");
  const diagnostics = runDiagnostics({ run, workspaceExists: (w) => existsSync(join(cwd, w)) });
  const mode = incremental ? "incremental" : "full";
  const built = buildContext({ run, dir: cwd, docsDir: import.meta.dirname, meta, base, baseSha, mode, previous, diagnostics });
  if (!built.ok) return fail(built.error);

  const guide = readFileSync(join(import.meta.dirname, "guide.md"), "utf8");
  const prompt = previous === undefined
    ? buildPrompt({ guide, prNumber: pr, headSha: meta.headSha, mode: "full" })
    : buildPrompt({ guide, prNumber: pr, headSha: meta.headSha, mode: "incremental", previousHeadSha: previous.headSha });

  deps.log(`리뷰어를 띄우는 중(PR #${pr}, ${mode})...`);
  const reviewer = run("claude", REVIEWER_ARGS, { input: prompt });
  writeFileSync(join(outDir, OUT_FILES.execution), reviewer.stdout);
  if (reviewer.code !== 0) return fail(`리뷰어가 비정상 종료했다(코드 ${reviewer.code}): ${reviewer.stderr.trim()}\n기록: ${join(OUT_DIR, OUT_FILES.execution)}`);

  const body = readIfExists(join(outDir, OUT_FILES.review));
  const decisionRaw = readIfExists(join(outDir, OUT_FILES.decision));
  if (body === undefined || decisionRaw === undefined) {
    return fail(`리뷰어가 ${OUT_DIR}/${OUT_FILES.review} 와 ${OUT_DIR}/${OUT_FILES.decision} 를 모두 쓰지 않았다. 기록: ${join(OUT_DIR, OUT_FILES.execution)}`);
  }
  const commentsRaw = readIfExists(join(outDir, OUT_FILES.comments));
  const patch = run("git", diffArgs(base, meta.headSha, ["-U0"]));
  if (patch.code !== 0) return fail(`git diff -U0 에 실패했다: ${patch.stderr.trim()}`);

  const touched = run("git", ["status", "--porcelain"]).stdout.trimEnd();
  const errors = validateReview({ expected: { headSha: meta.headSha, mode }, body, decision: decisionRaw, comments: commentsRaw, addedLines: parseAddedLines(patch.stdout) });
  if (touched !== "") errors.push(`리뷰어가 ${CONTEXT_DIR}/ · ${OUT_DIR}/ 밖의 파일을 바꾸거나 만들었다:\n${touched}\n되돌린 뒤 다시 실행한다.`);
  if (errors.length > 0) return fail(`리뷰 출력이 규칙에 맞지 않는다:\n${errors.map((e) => `- ${e}`).join("\n")}`);

  const decision = parseDecision(decisionRaw);
  if (decision === undefined) return fail(`${OUT_FILES.decision} 를 읽지 못했다.`);
  deps.log(`판정: ${decision}`);
  deps.log(`본문: ${join(OUT_DIR, OUT_FILES.review)}`);
  if (!submit) {
    deps.log("드라이 런이라 게시하지 않았다. 게시하려면 --submit 을 붙여 다시 실행한다.");
    return 0;
  }

  if (viewer === undefined) return fail("gh 로그인 계정을 알아내지 못해 게시하지 않았다. `gh auth status` 를 확인한다.");
  const payload = buildReviewPayload({
    headSha: meta.headSha, body, decision, comments: commentsRaw === undefined ? [] : parseComments(commentsRaw),
    authorLogin: meta.authorLogin, viewerLogin: viewer,
  });
  const posted = submitReview(payload, pr, join(outDir, OUT_FILES.payload), run);
  if (!posted.ok) return fail(posted.error);
  deps.log(`게시했다: ${posted.url}`);
  return 0;
}

function realRun(cwd: string): Run {
  return (cmd, args, options) => {
    const result = spawnSync(cmd, args, { cwd, encoding: "utf8", input: options?.input, maxBuffer: 512 * 1024 * 1024 });
    return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? (result.error === undefined ? "" : String(result.error)) };
  };
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) {
  const cwd = process.cwd();
  process.exitCode = main(process.argv.slice(2), { run: realRun(cwd), cwd, log: (s) => console.log(s), error: (s) => console.error(s) });
}

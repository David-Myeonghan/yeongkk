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
  "사용법: npm run review -- <PR 번호> [--base <git ref>] [--incremental] [--submit]",
  "",
  "  --base <ref>    이 ref 와 비교한 변경만 리뷰한다. 쌓인 PR 이면 앞 PR 의 브랜치를 준다.",
  "                  주지 않으면 origin/<PR 의 base 브랜치> 를 쓴다.",
  "  --incremental   내 지난 리뷰 이후의 새 커밋만 본다. 지난 리뷰가 없으면 멈춘다.",
  "  --submit        리뷰를 GitHub 에 게시한다. 주지 않으면 파일만 만들고 멈춘다(드라이 런).",
].join("\n");

const REQUIRED_TOOLS = ["claude", "gh", "git"] as const;
const REVIEWER_ARGS = ["-p", "--permission-mode", "acceptEdits", "--allowedTools", "Bash,Read,Grep,Glob,Write", "--output-format", "stream-json", "--verbose"];

export type Args = { pr: number; base: string | undefined; incremental: boolean; submit: boolean };
export type ArgsResult = { ok: true; args: Args } | { ok: false; error: string };

export function parseArgs(argv: string[]): ArgsResult {
  let pr: number | undefined;
  let base: string | undefined;
  let incremental = false;
  let submit = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--incremental") incremental = true;
    else if (arg === "--submit") submit = true;
    else if (arg === "--base") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return { ok: false, error: "--base 뒤에 git ref 가 필요하다." };
      base = value;
      i += 1;
    } else if (/^[1-9]\d*$/.test(arg) && pr === undefined) pr = Number(arg);
    else return { ok: false, error: `알 수 없는 인자: ${arg}` };
  }
  if (pr === undefined) return { ok: false, error: "PR 번호가 필요하다." };
  return { ok: true, args: { pr, base, incremental, submit } };
}

export type Deps = { run: Run; cwd: string; log: (line: string) => void; error: (line: string) => void };

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function fetchPreviousReview(deps: Deps, pr: number, viewer: string): PreviousReview | undefined {
  const jq = ".[] | {user: .user.login, body: .body, html_url: .html_url}";
  const result = deps.run("gh", ["api", `repos/{owner}/{repo}/pulls/${pr}/reviews`, "--paginate", "--jq", jq]);
  if (result.code !== 0) return undefined;
  return pickPreviousReview(parseReviews(result.stdout), viewer);
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

  const view = run("gh", ["pr", "view", String(pr), "--json", "number,title,body,author,baseRefName,headRefName,headRefOid"]);
  if (view.code !== 0) return fail(`PR #${pr} 를 읽지 못했다: ${view.stderr.trim()}`);
  const metaResult = parsePrMeta(view.stdout);
  if (!metaResult.ok) return fail(metaResult.error);
  const meta = metaResult.meta;

  const head = run("git", ["rev-parse", "HEAD"]).stdout.trim();
  if (head !== meta.headSha) {
    return fail(`로컬 HEAD(${head.slice(0, 12)})가 PR #${pr} 의 head(${meta.headSha.slice(0, 12)})와 다르다. PR 브랜치(${meta.headRefName})를 체크아웃하고 최신으로 받은 뒤 다시 실행한다.`);
  }
  const base = parsed.args.base ?? `origin/${meta.baseRefName}`;

  const needsViewer = incremental || submit;
  const viewer = needsViewer ? viewerLogin(deps) : undefined;
  if (needsViewer && viewer === undefined) return fail("gh 로그인 계정을 알아내지 못했다. `gh auth status` 를 확인한다.");

  let previous: PreviousReview | undefined;
  if (incremental && viewer !== undefined) {
    previous = fetchPreviousReview(deps, pr, viewer);
    if (previous === undefined) return fail(`증분 리뷰를 할 수 없다. PR #${pr} 에 ${viewer} 가 올린 yk-review 표지의 지난 리뷰가 없다. --incremental 없이 실행한다.`);
    if (run("git", ["cat-file", "-e", `${previous.headSha}^{commit}`]).code !== 0) {
      return fail(`지난 리뷰의 head(${previous.headSha.slice(0, 12)})가 로컬에 없다. git fetch 로 받은 뒤 다시 실행한다.`);
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
  const built = buildContext({ run, dir: cwd, docsDir: import.meta.dirname, meta, base, mode, previous, diagnostics });
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

  const errors = validateReview({ expected: { headSha: meta.headSha, mode }, body, decision: decisionRaw, comments: commentsRaw, addedLines: parseAddedLines(patch.stdout) });
  if (errors.length > 0) return fail(`리뷰 출력이 규칙에 맞지 않는다:\n${errors.map((e) => `- ${e}`).join("\n")}`);

  const decision = parseDecision(decisionRaw);
  if (decision === undefined) return fail(`${OUT_FILES.decision} 를 읽지 못했다.`);
  deps.log(`판정: ${decision}`);
  deps.log(`본문: ${join(OUT_DIR, OUT_FILES.review)}`);
  if (!submit) {
    deps.log("드라이 런이라 게시하지 않았다. 게시하려면 --submit 을 붙여 다시 실행한다.");
    return 0;
  }

  const payload = buildReviewPayload({
    headSha: meta.headSha, body, decision, comments: commentsRaw === undefined ? [] : parseComments(commentsRaw),
    authorLogin: meta.authorLogin, viewerLogin: viewer ?? "",
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

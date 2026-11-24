import type { Run } from "./types";

const TAIL_LINES = 30;
const WORKSPACES = ["api", "web"] as const;

export type Check = { name: string; args: string[] };

export function plannedChecks(workspaceExists: (workspace: string) => boolean): Check[] {
  const root: Check[] = [
    { name: "npm run lint", args: ["run", "lint"] },
    { name: "npm run typecheck", args: ["run", "typecheck"] },
    { name: "npm test", args: ["test"] },
  ];
  const workspaces = WORKSPACES.filter(workspaceExists).flatMap((w): Check[] => [
    { name: `npm test -w ${w}`, args: ["test", "-w", w] },
    { name: `npm run typecheck -w ${w}`, args: ["run", "typecheck", "-w", w] },
  ]);
  return [...root, ...workspaces];
}

type Outcome = { name: string; ok: boolean; seconds: number; tail: string; code: number };

function tailOf(text: string): string {
  return text.split("\n").slice(-TAIL_LINES).join("\n");
}

function execute(check: Check, run: Run, now: () => number): Outcome {
  const started = now();
  try {
    const result = run("npm", check.args);
    const output = [result.stdout.trimEnd(), result.stderr.trimEnd()].filter((part) => part !== "").join("\n");
    return { name: check.name, ok: result.code === 0, code: result.code, seconds: (now() - started) / 1000, tail: tailOf(output) };
  } catch (error) {
    return { name: check.name, ok: false, code: -1, seconds: (now() - started) / 1000, tail: `실행하지 못했다: ${String(error)}` };
  }
}

export function renderDiagnostics(outcomes: Outcome[]): string {
  const summary = outcomes.map((o) => `- ${o.ok ? "✅" : "❌"} ${o.name} (${o.seconds.toFixed(1)}초)`);
  const failed = outcomes.filter((o) => !o.ok);
  const head = ["# 진단 결과", "", "리뷰 전에 이미 돌린 결과다. 다시 돌리지 않는다.", "", ...summary];
  if (failed.length === 0) return `${head.join("\n")}\n`;
  const tails = failed.flatMap((o) => ["", `### ${o.name} (종료 코드 ${o.code})`, "", "````text", o.tail, "````"]);
  return [...head, "", `## 실패한 검사의 끝 ${TAIL_LINES}줄`, ...tails].join("\n") + "\n";
}

export function runDiagnostics(input: { run: Run; workspaceExists: (workspace: string) => boolean; now?: () => number }): string {
  const now = input.now ?? Date.now;
  return renderDiagnostics(plannedChecks(input.workspaceExists).map((check) => execute(check, input.run, now)));
}

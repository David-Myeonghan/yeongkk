import { describe, expect, it } from "vitest";
import { plannedChecks, runDiagnostics } from "./diagnostics";
import type { Run } from "./types";

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");

describe("plannedChecks", () => {
  it("워크스페이스 폴더가 없으면 루트 검사 셋만 돈다", () => {
    expect(plannedChecks(() => false).map((c) => c.name)).toEqual(["npm run lint", "npm run typecheck", "npm test"]);
  });

  it("폴더가 있는 워크스페이스만 더한다", () => {
    const names = plannedChecks((w) => w === "api").map((c) => c.name);
    expect(names).toEqual(["npm run lint", "npm run typecheck", "npm test", "npm test -w api", "npm run typecheck -w api"]);
  });

  it("두 폴더가 다 있으면 일곱 개다", () => {
    expect(plannedChecks(() => true).map((c) => c.name)).toEqual([
      "npm run lint", "npm run typecheck", "npm test",
      "npm test -w api", "npm run typecheck -w api", "npm test -w web", "npm run typecheck -w web",
    ]);
  });
});

describe("runDiagnostics", () => {
  it("실패한 검사는 ❌ 와 끝 30줄을 남기고 던지지 않는다", () => {
    const run: Run = (_cmd, args) =>
      args.join(" ") === "test" ? { code: 1, stdout: lines(50), stderr: "boom" } : { code: 0, stdout: "ok-output", stderr: "" };
    const md = runDiagnostics({ run, workspaceExists: () => false });
    expect(md).toContain("✅ npm run lint");
    expect(md).toContain("❌ npm test");
    expect(md).toContain("boom");
    expect(md).toContain("line 50");
    expect(md).toContain("line 22");
    expect(md).not.toContain("line 21\n");
    expect(md).not.toContain("ok-output");
  });

  it("실행 자체가 던져도 기록하고 이어 간다", () => {
    const run: Run = (_cmd, args) => {
      if (args[1] === "lint") throw new Error("spawn 실패");
      return { code: 0, stdout: "", stderr: "" };
    };
    const md = runDiagnostics({ run, workspaceExists: () => false });
    expect(md).toContain("❌ npm run lint");
    expect(md).toContain("spawn 실패");
    expect(md).toContain("✅ npm run typecheck");
  });

  it("검사마다 걸린 초를 적는다", () => {
    const ticks = [0, 1500, 2000, 2000, 5000, 9200];
    let i = 0;
    const run: Run = () => ({ code: 0, stdout: "", stderr: "" });
    const md = runDiagnostics({ run, workspaceExists: () => false, now: () => ticks[i++] ?? 0 });
    expect(md).toContain("npm run lint (1.5초)");
    expect(md).toContain("npm test (4.2초)");
  });

  it("모두 통과하면 실패 절이 없다", () => {
    const run: Run = () => ({ code: 0, stdout: "x", stderr: "" });
    const md = runDiagnostics({ run, workspaceExists: () => false });
    expect(md).not.toContain("❌");
    expect(md).not.toContain("실패한 검사");
  });

  it("npm 을 정해진 인자로 부른다", () => {
    const seen: string[] = [];
    const run: Run = (cmd, args) => {
      seen.push([cmd, ...args].join(" "));
      return { code: 0, stdout: "", stderr: "" };
    };
    runDiagnostics({ run, workspaceExists: (w) => w === "web" });
    expect(seen).toEqual(["npm run lint", "npm run typecheck", "npm test", "npm test -w web", "npm run typecheck -w web"]);
  });
});

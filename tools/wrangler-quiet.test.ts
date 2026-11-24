import { spawnSync, execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../scripts/ci/wrangler-quiet.sh");
const filter = (code: number, input: string): string =>
  execFileSync("bash", [script, "--yk-filter", String(code)], { input, encoding: "utf8" });
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const lines = (...rows: string[]): string => rows.join("\n") + "\n";

const fixture = [
  "⛅️ wrangler 4.0.0",
  "Total Upload: 12.3 KiB / gzip: 4.1 KiB",
  "Deployed yeongkk triggers",
  "  https://yeongkk.someone.workers.dev",
  '"database_id": "11111111-2222-3333-4444-555555555555"',
  "owner contact: someone@example.com",
  "✘ [ERROR] A request to the Cloudflare API failed. Authentication error [code: 10000]",
  "",
  "Getting User settings...",
  "👋 You are logged in with an API Token.",
  "┌──────────────────────┬──────────────────────────────────┐",
  "│ Account Name         │ Account ID                       │",
  "├──────────────────────┼──────────────────────────────────┤",
  "│ someone@example.com's Account │ abcdef                 │",
  "└──────────────────────┴──────────────────────────────────┘",
  "🔓 Token Permissions:",
  "Scope (Access)",
  "- workers (write)",
  "🪵  Logs were written to /tmp/wrangler.log",
  "",
].join("\n");

describe("wrangler-quiet 걸러내기", () => {
  it("성공(0): 이메일만 가리고 주소 · database_id 는 남긴다", () => {
    const out = filter(0, fixture);
    expect(out).not.toContain("someone@example.com");
    expect(out).toContain("[가림]");
    expect(out).toContain("https://yeongkk.someone.workers.dev");
    expect(out).toContain('"database_id": "11111111-2222-3333-4444-555555555555"');
    expect(out).toContain("Account Name");
    expect(out).not.toContain("가렸습니다");
    expect(out).not.toContain("whoami");
  });

  it("실패(1): 계정 표 · whoami 구역을 지우고 오류 줄과 안내를 남긴다", () => {
    const out = filter(1, fixture);
    expect(out).not.toContain("@");
    expect(out).toContain("[code: 10000]");
    expect(out).toContain("https://yeongkk.someone.workers.dev");
    expect(out).toContain("database_id");
    expect(out).toContain("Logs were written");
    for (const gone of ["Account Name", "│", "┌", "├", "└", "Getting User settings", "You are logged in", "Token Permissions", "workers (write)"]) {
      expect(out).not.toContain(gone);
    }
    expect(out.trimEnd().split("\n").at(-1)).toContain("npx wrangler whoami");
  });

  describe("표 줄 규칙 (구역 밖)", () => {
    it("줄 맨 앞이 표 문자인 줄만 지운다 (│ ┌ ├ └ |)", () => {
      const out = filter(
        1,
        lines(
          "build start",
          "│ SECRET_BAR │ Account ID │",
          "┌ SECRET_TOP ┐",
          "├ SECRET_MID ┤",
          "└ SECRET_BOTTOM ┘",
          "| SECRET_PIPE | Account ID |",
          "   │ SECRET_INDENT │",
          "build end",
        ),
      );
      expect(out).not.toContain("SECRET_");
      expect(out).toContain("build start");
      expect(out).toContain("build end");
    });

    it("색 코드가 앞에 붙은 표 줄도 지운다", () => {
      const out = filter(1, lines("build start", "\u001b[90m│ SECRET_COLOR │\u001b[0m", "\u001b[2m\u001b[90m├ SECRET_COLOR2 ┤", "build end"));
      expect(out).not.toContain("SECRET_");
      expect(out).toContain("build end");
    });

    it("줄 중간의 │ · || 는 표 줄이 아니라서 남긴다 (esbuild 소스 발췌, SQL)", () => {
      const out = filter(
        1,
        lines(
          '✘ [ERROR] Could not resolve "./askk"',
          "    src/index.ts:1:21:",
          '      1 │ import { postAsk } from "./askk";',
          "        ╵                      ~~~~~~~~",
          "SELECT a || b FROM t",
        ),
      );
      expect(out).toContain('1 │ import { postAsk } from "./askk";');
      expect(out).toContain("SELECT a || b FROM t");
      expect(out).toContain("src/index.ts:1:21:");
    });

    it("Getting User settings 줄 없이 나온 표 머리줄 · 데이터 줄도 계정 이름이 나가지 않는다", () => {
      const out = filter(
        1,
        lines("build start", "│ Account Name │ Account ID │", "│ my-secret-team's Account │ abcdef │", "build end"),
      );
      expect(out).not.toContain("my-secret-team");
      expect(out).not.toContain("Account Name");
      expect(out).toContain("build end");
    });
  });

  describe("구역 시작", () => {
    it.each([
      ["Getting User settings", "Getting User settings..."],
      ["You are logged in", "👋 You are logged in with an API Token."],
      ["색 코드가 낀 Getting User settings", "\u001b[1mGetting User settings\u001b[0m..."],
    ])("%s 부터 끝 표시까지 지운다", (_name, start) => {
      const out = filter(1, lines("before", start, "SECRET_NAME line", "SECRET_SCOPE line", "🪵  Logs were written to x", "after"));
      expect(out).not.toContain("SECRET_");
      expect(out).toContain("before");
      expect(out).toContain("Logs were written");
      expect(out).toContain("after");
    });
  });

  describe("구역 끝", () => {
    it.each([
      ["🪵 로그 줄", "🪵  Logs were written to /tmp/x.log"],
      ["✘ 줄", "✘ failure without tag"],
      ["들여쓴 ✘ 줄", "  ✘ failure without tag"],
      ["▲ 줄", "▲ caution without tag"],
      ["줄 맨 앞 [ERROR]", "[ERROR] bare error"],
      ["줄 맨 앞 [WARNING]", "[WARNING] bare warning"],
      ["✘ [ERROR] 줄", "✘ [ERROR] A request to the Cloudflare API failed"],
      ["색 코드가 낀 ✘ [ERROR] 줄", "\u001b[31m✘ \u001b[41;31m[\u001b[41;97mERROR\u001b[41;31m]\u001b[0m A request failed"],
      ["▲ [WARNING] 줄", "▲ [WARNING] something odd"],
    ])("%s 에서 구역이 닫히고 그 줄과 뒤 줄이 나온다", (_name, end) => {
      const out = filter(
        1,
        lines("Getting User settings...", "👋 You are logged in with an API Token.", "SECRET_NAME line", end, "TAIL_LINE one", "TAIL_LINE two"),
      );
      expect(out).not.toContain("SECRET_");
      expect(out).not.toContain("Getting User settings");
      expect(out.replace(ansi, "")).toContain(end.replace(ansi, "").trim());
      expect(out).toContain("TAIL_LINE one");
      expect(out).toContain("TAIL_LINE two");
    });

    it("whoami 블록 바로 뒤에 ✘ [ERROR] 가 오고 🪵 가 없어도 오류와 그 뒤가 나오고 계정 이름은 안 나온다", () => {
      const out = filter(
        1,
        lines(
          "Getting User settings...",
          "👋 You are logged in with an API Token.",
          "┌─────┬─────┐",
          "│ Account Name │ Account ID │",
          "│ my-secret-team's Account │ abcdef │",
          "└─────┴─────┘",
          "✘ [ERROR] Authentication error [code: 10000]",
          "  If you think this is a bug, report it.",
        ),
      );
      expect(out).not.toContain("my-secret-team");
      expect(out).toContain("[code: 10000]");
      expect(out).toContain("If you think this is a bug");
    });
  });

  describe("래퍼 (가짜 npm)", () => {
    it("인자 · 종료 코드를 그대로 전달하고, 출력은 걸러서 내고, 임시 파일을 남기지 않는다", () => {
      const root = mkdtempSync(join(tmpdir(), "yk-quiet-"));
      const bin = join(root, "bin");
      const tmp = join(root, "tmp");
      mkdirSync(bin);
      mkdirSync(tmp);
      writeFileSync(join(bin, "npm"), '#!/bin/sh\necho "ARGS:$*"\necho "owner: someone@example.com"\nexit 7\n');
      chmodSync(join(bin, "npm"), 0o755);
      const run = spawnSync("bash", [script, "d1", "execute", "yeongkk", "--local"], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, TMPDIR: tmp },
      });
      expect(run.status).toBe(7);
      expect(run.stdout).toContain("ARGS:exec --no -- wrangler d1 execute yeongkk --local");
      expect(run.stdout).not.toContain("someone@example.com");
      expect(run.stdout).toContain("[가림]");
      expect(run.stdout).toContain("npx wrangler whoami");
      expect(readdirSync(tmp)).toEqual([]);
    });

    it("성공(0)이면 종료 코드 0, 안내 줄 없음", () => {
      const root = mkdtempSync(join(tmpdir(), "yk-quiet-"));
      writeFileSync(join(root, "npm"), '#!/bin/sh\necho "ok $*"\n');
      chmodSync(join(root, "npm"), 0o755);
      const run = spawnSync("bash", [script, "deploy"], { encoding: "utf8", env: { ...process.env, PATH: `${root}:${process.env.PATH ?? ""}` } });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("ok exec --no -- wrangler deploy");
      expect(run.stdout).not.toContain("가렸습니다");
    });
  });
});

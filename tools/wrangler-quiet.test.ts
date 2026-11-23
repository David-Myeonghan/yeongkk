import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../scripts/ci/wrangler-quiet.sh");
const filter = (code: number, input: string): string =>
  execFileSync("bash", [script, "--yk-filter", String(code)], { input, encoding: "utf8" });

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
});

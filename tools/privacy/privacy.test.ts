import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_NAMES } from "../../quiz-core/events";
import { PRIVACY_CONTACT, PRIVACY_CONTACT_PLACEHOLDER } from "./contact";
import { OUTPUTS, build } from "./cli";
import { policy } from "./content";
import { renderHtml, renderMarkdown } from "./render";

const root = join(import.meta.dirname, "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const textOf = (doc: ReturnType<typeof policy>) =>
  doc.sections.flatMap((s) => [s.title, ...s.blocks.flatMap((b) => ("p" in b ? [b.p] : b.ul))]).join("\n");

describe("문서와 웹 페이지가 어긋나지 않는다", () => {
  const built = build(PRIVACY_CONTACT);

  it("docs/privacy.md 가 내용에서 만든 것과 같다 (문서만 손으로 고치면 빨개진다)", () => {
    expect(readFileSync(OUTPUTS.markdown, "utf8")).toBe(built.markdown);
  });

  it("웹 페이지가 내용에서 만든 것과 같다 (페이지만 손으로 고치면 빨개진다)", () => {
    expect(readFileSync(OUTPUTS.html, "utf8")).toBe(built.html);
  });

  it("문의처를 바꾸면 두 출력이 함께 바뀐다 (한쪽에 문의처를 박아 두면 빨개진다)", () => {
    const other = build("privacy@example.com");
    expect(other.markdown).toContain("privacy@example.com");
    expect(other.html).toContain("privacy@example.com");
    expect(other.markdown).not.toContain(PRIVACY_CONTACT_PLACEHOLDER);
    expect(other.html).not.toContain(PRIVACY_CONTACT_PLACEHOLDER);
  });

  it("문의처 자리표시는 한 곳(contact.ts)에서만 온다", () => {
    expect(built.markdown.split(PRIVACY_CONTACT).length - 1).toBe(1);
    expect(renderMarkdown(policy("X"))).not.toContain(PRIVACY_CONTACT_PLACEHOLDER);
  });

  it("웹 페이지는 스크립트 · 외부 파일 · 폼이 없다", () => {
    const html = renderHtml(policy("X"));
    expect(html).not.toMatch(/<script|<link|<form|<iframe|<img|src=/i);
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/", "/"]);
    expect(html).toContain("prefers-color-scheme:dark");
  });

  it("웹 페이지는 위와 아래에 돌아가기 링크가 있고, 문서 사본에는 없다 (앱 웹뷰에는 뒤로 갈 길이 이것뿐이다)", () => {
    const html = renderHtml(policy("X"));
    expect(html.match(/<a href="\/">← 뭔말이야로 돌아가기<\/a>/g)).toHaveLength(2);
    expect(html.indexOf("돌아가기")).toBeLessThan(html.indexOf("<h1>"));
    expect(renderMarkdown(policy("X"))).not.toContain("돌아가기");
  });

  it("HTML 특수문자는 막는다", () => {
    expect(renderHtml(policy("<b>&\"x"))).toContain("&lt;b&gt;&amp;&quot;x");
  });
});

describe("방침이 코드와 맞는다", () => {
  const text = textOf(policy("X"));

  it("서버가 받는 행동 이름을 전부 적었다 (행동을 추가하고 방침을 안 고치면 빨개진다)", () => {
    for (const name of EVENT_NAMES) expect(text).toContain(name);
  });

  it("기기에 저장하는 키를 전부 적었다", () => {
    const keys = [read("web", "src", "state", "progress.ts"), read("web", "src", "state", "completed.ts"), read("web", "src", "telemetry", "anonId.ts"), read("web", "src", "telemetry", "queue.ts")]
      .flatMap((src) => [...src.matchAll(/"(yk\.[a-z]+\.v\d+)"/g)].map((m) => m[1]));
    expect(keys.sort()).toEqual(["yk.anon.v1", "yk.completed.v1", "yk.events.v1", "yk.progress.v1"]);
    for (const key of keys) expect(text).toContain(key);
  });

  it("서버 표의 칸이 방침이 말한 것뿐이다 (IP · User-Agent 칸이 생기면 빨개진다)", () => {
    const sql = readdirSync(join(root, "api", "migrations")).map((f) => read("api", "migrations", f)).join("\n");
    const tables = Object.fromEntries(
      [...sql.matchAll(/CREATE TABLE (\w+) \(([^;]*?)\);/gs)].map((m) => [
        m[1],
        [...m[2].matchAll(/^\s*(\w+)\s+(?:INTEGER|TEXT)/gm)].map((c) => c[1]).sort(),
      ]),
    );
    expect(tables).toEqual({
      events: ["anon_id", "app_version", "day", "host", "id", "locale", "name", "props", "received_at"],
      reports: ["anon_id", "day", "id", "locale", "received_at", "word"],
    });
  });

  it("서버는 Origin · Content-Length · Authorization 말고 요청 머리글을 읽지 않는다", () => {
    const files = execFileSync("git", ["ls-files", "api/src"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "");
    const read_ = files.flatMap((f) => [...read(f).matchAll(/headers\.get\(\s*["']([^"']+)["']/g)].map((m) => m[1]));
    expect(new Set(read_)).toEqual(new Set(["Authorization", "Origin", "Content-Length"]));
    for (const f of files) expect(read(f)).not.toMatch(/CF-Connecting-IP|User-Agent|request\.cf\b|cookie/i);
  });

  it("웹 코드가 쿠키를 만들지 않는다", () => {
    const files = execFileSync("git", ["ls-files", "web/src", "bridge"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    for (const f of files) expect(read(f)).not.toMatch(/document\.cookie/);
  });

  it("쓰는 곳 · 연령 · 문의처 절이 있다", () => {
    const titles = policy("X").sections.map((s) => s.title);
    for (const t of ["함께 쓰는 곳", "어린이", "삭제를 요청하려면", "문의", "얼마나 오래 보관하나"]) expect(titles).toContain(t);
    expect(text).toContain("16세 이상");
    expect(text).toContain("자동 삭제는 아직 없다");
  });
});

describe("정적 페이지가 Worker 설정과 부딪히지 않는다", () => {
  const wrangler = read("api", "wrangler.jsonc");

  it("Worker 를 먼저 거치는 경로는 /api/* 뿐이라 /privacy/ 는 정적 파일로 간다 (경로를 넓히면 빨개진다)", () => {
    expect(wrangler).toMatch(/"run_worker_first"\s*:\s*\[\s*"\/api\/\*"\s*\]/);
  });

  it("앱 길(SPA 대체)은 그대로이고, 방침 파일은 web/public 에서 dist 로 간다", () => {
    expect(wrangler).toContain('"not_found_handling": "single-page-application"');
    expect(OUTPUTS.html).toBe(join(root, "web", "public", "privacy", "index.html"));
  });
});

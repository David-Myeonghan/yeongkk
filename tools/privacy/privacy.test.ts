import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_NAMES } from "../../quiz-core/events";
import { PRIVACY_CONTACT, PRIVACY_CONTACT_PLACEHOLDER } from "./contact";
import { CONTACT_ERROR, OUTPUTS, build, requireContact } from "./cli";
import { policy } from "./content";
import { tablesFrom } from "./schema";
import { renderHtml, renderMarkdown } from "./render";

const root = join(import.meta.dirname, "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const storageKeysIn = (src: string): string[] => [...src.matchAll(/["'`](yk\.[a-z0-9-]+(?:\.[a-z0-9-]+)*)["'`]/g)].map((m) => m[1]);
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
    expect(build(PRIVACY_CONTACT_PLACEHOLDER).markdown.split(PRIVACY_CONTACT_PLACEHOLDER).length - 1).toBe(1);
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

  it("기기에 저장하는 키를 전부 적었다 (web/src 어디든 yk. 키를 더하고 방침을 안 고치면 빨개진다)", () => {
    const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "web/src"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    const inCode = new Set(files.flatMap((f) => storageKeysIn(read(f))));
    const inPolicy = new Set(text.match(/yk\.[a-z0-9-]+(?:\.[a-z0-9-]+)*/g) ?? []);
    expect([...inCode].sort()).toEqual(["yk.anon.v1", "yk.completed.v1", "yk.events.v1", "yk.progress.v1", "yk.round-flags.v1"]);
    expect([...inPolicy].sort()).toEqual([...inCode].sort());
  });

  it("키 찾기는 -, 숫자가 든 키도 잡는다", () => {
    expect(storageKeysIn('const K = "yk.round-flags.v1"; const J = `yk.a2.b-c.v10`; const x = "ykx.no";')).toEqual(["yk.round-flags.v1", "yk.a2.b-c.v10"]);
  });

  it("서버 표의 칸이 방침이 말한 것뿐이다 (IP · User-Agent 칸이 생기면 빨개진다)", () => {
    const dir = join(root, "api", "migrations");
    const sql = readdirSync(dir).sort().map((f) => read("api", "migrations", f));
    expect(tablesFrom(sql)).toEqual({
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

describe("마이그레이션 읽기", () => {
  const base = "CREATE TABLE events (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\nCREATE INDEX events_name ON events (name);";

  it("ALTER TABLE ADD COLUMN 으로 더한 칸도 센다 (CREATE TABLE 만 읽으면 빨개진다)", () => {
    const tables = tablesFrom([base, "ALTER TABLE events ADD COLUMN ip TEXT;"]);
    expect(tables.events).toEqual(["id", "ip", "name"]);
  });

  it("모르는 문장 모양은 무시하지 않고 던진다", () => {
    expect(() => tablesFrom([base, "ALTER TABLE events RENAME COLUMN name TO ip;"])).toThrow(/모르는 SQL/);
    expect(() => tablesFrom([base, "DROP TABLE events;"])).toThrow(/모르는 SQL/);
    expect(() => tablesFrom(["ALTER TABLE ghost ADD COLUMN x TEXT;"])).toThrow(/없는 표/);
  });
});

describe("배포 전 문의처 검사", () => {
  it.each([PRIVACY_CONTACT_PLACEHOLDER, "", "  ", ` ${PRIVACY_CONTACT_PLACEHOLDER} `])("자리표시 %j 이면 1 과 ::error:: 한국어 메시지 (검사를 지우면 빨개진다)", (contact) => {
    const lines: string[] = [];
    expect(requireContact(contact, (l) => lines.push(l))).toBe(1);
    expect(lines).toEqual([`::error::${CONTACT_ERROR}`]);
    expect(CONTACT_ERROR).toContain("tools/privacy/contact.ts");
  });

  it("실제 문의처이면 0 이고 아무것도 안 낸다 (저장소의 현재 값에 기대지 않는다)", () => {
    const lines: string[] = [];
    expect(requireContact("privacy@example.com", (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual([]);
  });

  it("deploy.yml 이 D1 확인과 npm ci 다음, 검사 · 빌드 · 올리기 앞에서 이 검사를 부른다", () => {
    const yml = read(".github", "workflows", "deploy.yml");
    const at = (needle: string) => yml.indexOf(needle);
    expect(at("DB 가 만들어졌는지 확인")).toBeGreaterThan(0);
    expect(at("tools/privacy/cli.ts --require-contact")).toBeGreaterThan(at("npm ci"));
    expect(at("npm ci")).toBeGreaterThan(at("DB 가 만들어졌는지 확인"));
    expect(at("npm run check")).toBeGreaterThan(at("tools/privacy/cli.ts --require-contact"));
    expect(at("wrangler-quiet.sh deploy")).toBeGreaterThan(at("tools/privacy/cli.ts --require-contact"));
  });
});

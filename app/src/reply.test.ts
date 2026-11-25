import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { receiveScript } from "./reply";

function run(reply: string): { received: unknown[]; result: unknown } {
  const received: unknown[] = [];
  const sandbox = { window: { __YK_BRIDGE__: { receive: (raw: unknown) => received.push(raw) } } };
  const result = runInNewContext(receiveScript(reply), sandbox, { timeout: 5000 });
  return { received, result };
}

const hostile: Array<[string, string]> = [
  ["평범한 JSON", JSON.stringify({ v: 1, kind: "response", id: "a", ok: true })],
  ["작은따옴표", `it's 'quoted'`],
  ["큰따옴표로 문자열 탈출", `"); throw new Error("pwn"); ("`],
  ["백슬래시", "a\\b\\\\c\\"],
  ["끝 백슬래시와 따옴표", `\\"`],
  ["script 닫는 태그", "</script><script>alert(1)</script>"],
  ["U+2028 U+2029", "a\u2028b\u2029c"],
  ["줄바꿈과 널", "line1\nline2\r\n\0end"],
  ["템플릿 리터럴", "`${process.exit()}`"],
  ["외톨이 서로게이트", "x\ud800y"],
  ["주석 시작", "*/ // /*"],
  ["이모지와 한글", "뭔말이야 😀"],
  ["빈 문자열", ""],
];

describe("receiveScript", () => {
  it.each(hostile)("%s 도 원문 그대로 receive 에 닿는다", (_name, payload) => {
    const { received } = run(payload);
    expect(received).toEqual([payload]);
  });

  it("아주 긴 문자열도 한 번에 닿는다", () => {
    const payload = JSON.stringify({ blob: "가\"\\\u2028".repeat(500_000) });
    const { received } = run(payload);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(payload);
  });

  it("스크립트의 값은 true (injectJavaScript 가 요구)", () => {
    expect(run("x").result).toBe(true);
  });

  it("웹에 브릿지가 아직 없으면 조용히 넘어간다", () => {
    const result = runInNewContext(receiveScript("x"), { window: {} });
    expect(result).toBe(true);
  });

  it("스크립트 본문에 U+2028 · U+2029 · 꺾쇠 여는 괄호가 날것으로 남지 않는다", () => {
    const script = receiveScript("a\u2028b\u2029c</script>");
    expect(script).not.toMatch(/[\u2028\u2029]/);
    expect(script).not.toContain("<");
  });

  it("틀 모양 고정", () => {
    expect(receiveScript("x")).toBe('window.__YK_BRIDGE__&&window.__YK_BRIDGE__.receive("x");true;');
  });
});

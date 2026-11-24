import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { NotEnabledError, notEnabledProvider } from "./ask";

const post = (body: unknown) =>
  exports.default.fetch(
    new Request("https://yeongkk.test/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const valid = { anonId: "anon-ask-1234", locale: "ko-KR", word: "갑분싸" };

describe("POST /api/ask", () => {
  it("올바른 요청은 501 NOT_ENABLED", async () => {
    const res = await post(valid);
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ code: "NOT_ENABLED" });
  });

  it("형식 검사가 501 보다 먼저: 빈 글 · 21자 · 주소 · 전화번호 → 400", async () => {
    for (const word of ["", "  ", "가".repeat(21), "@a", "a.com", "010-1234-5678"]) {
      expect((await post({ ...valid, word })).status, word).toBe(400);
    }
    expect((await post({ ...valid, anonId: "x" })).status).toBe(400);
    expect((await post({ ...valid, locale: "ko" })).status).toBe(400);
    expect((await post("nope")).status).toBe(400);
  });

  it("본문 16KB 초과는 413", async () => {
    expect((await post({ ...valid, pad: "z".repeat(17000) })).status).toBe(413);
  });

  it("GET 은 405", async () => {
    const res = await exports.default.fetch(new Request("https://yeongkk.test/api/ask"));
    expect(res.status).toBe(405);
  });
});

describe("notEnabledProvider", () => {
  it("explain 은 NotEnabledError 로 거절한다", async () => {
    await expect(notEnabledProvider.explain("갑분싸", "ko-KR")).rejects.toBeInstanceOf(NotEnabledError);
  });
});

import { describe, expect, it } from "vitest";
import { loadWords } from "./loadWords";

const good = {
  id: "w1",
  word: "갓생",
  meaning: "부지런한 삶",
  examples: ["갓생 살자"],
  origin: "신조어",
  funnyWrong: ["신의 생일"],
  addedAt: "2026-11-01",
};

function respond(body: string, init: { status?: number } = {}): typeof fetch {
  return (async () => new Response(body, { status: init.status ?? 200 })) as typeof fetch;
}
const json = (value: unknown, init?: { status?: number }) => respond(JSON.stringify(value), init);

describe("loadWords", () => {
  it("올바른 모양이면 단어를 돌려준다", async () => {
    const r = await loadWords(json({ locale: "ko-KR", count: 1, words: [good] }), "ko-KR");
    expect(r).toEqual({ ok: true, words: [good] });
  });

  it("locale로 주소를 만들고 no-cache로 요청한다", async () => {
    const calls: [unknown, RequestInit | undefined][] = [];
    const fetchFn = (async (url: unknown, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ words: [good] }));
    }) as typeof fetch;
    await loadWords(fetchFn, "ko-KR");
    expect(calls).toEqual([["/words.ko-KR.json", { cache: "no-cache" }]]);
  });

  it("네트워크 오류는 network", async () => {
    const fetchFn = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    expect(await loadWords(fetchFn, "ko-KR")).toEqual({ ok: false, reason: "network" });
  });

  it("fetchFn이 동기로 던져도 밖으로 새지 않는다", async () => {
    const fetchFn = (() => {
      throw new Error("sync");
    }) as typeof fetch;
    expect(await loadWords(fetchFn, "ko-KR")).toEqual({ ok: false, reason: "network" });
  });

  it("본문을 읽다 실패하면 network", async () => {
    const fetchFn = (async () => ({ ok: true, text: () => Promise.reject(new Error("aborted")) })) as unknown as typeof fetch;
    expect(await loadWords(fetchFn, "ko-KR")).toEqual({ ok: false, reason: "network" });
  });

  it("OK가 아닌 응답은 network", async () => {
    expect(await loadWords(json({ words: [good] }, { status: 500 }), "ko-KR")).toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("words가 빈 배열이면 empty", async () => {
    expect(await loadWords(json({ count: 0, words: [] }), "ko-KR")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("모양이 틀리면 bad-shape", async () => {
    expect(await loadWords(json({ count: 1 }), "ko-KR")).toEqual({ ok: false, reason: "bad-shape" });
    expect(await loadWords(json({ words: "x" }), "ko-KR")).toEqual({ ok: false, reason: "bad-shape" });
    expect(await loadWords(json([good]), "ko-KR")).toEqual({ ok: false, reason: "bad-shape" });
    expect(await loadWords(json(null), "ko-KR")).toEqual({ ok: false, reason: "bad-shape" });
  });

  it("200인데 HTML이면 bad-shape이고 던지지 않는다", async () => {
    const fetchFn = respond("<!doctype html><html><body>app</body></html>");
    expect(await loadWords(fetchFn, "ko-KR")).toEqual({ ok: false, reason: "bad-shape" });
  });

  it("깨진 단어 하나는 버리고 나머지를 돌려준다", async () => {
    const other = { ...good, id: "w2" };
    const broken = { id: "w3", word: "x", examples: [], addedAt: "2026-11-01" };
    const r = await loadWords(json({ count: 3, words: [good, broken, other] }), "ko-KR");
    expect(r.ok && r.words.map((w) => w.id)).toEqual(["w1", "w2"]);
  });

  it("타입이 틀린 필수 칸이 있으면 그 단어를 버린다", async () => {
    const bad = [
      { ...good, id: 1 },
      { ...good, examples: "x" },
      { ...good, examples: [1] },
      { ...good, addedAt: 20261101 },
      null,
      "str",
    ];
    expect(await loadWords(json({ words: bad }), "ko-KR")).toEqual({ ok: false, reason: "empty" });
  });

  it("모르는 칸은 복사하지 않는다", async () => {
    const r = await loadWords(json({ words: [{ ...good, secret: "x", status: "retired" }] }), "ko-KR");
    expect(r).toEqual({ ok: true, words: [good] });
  });

  it("funnyWrong은 문자열만 남기고 origin은 문자열일 때만 남긴다", async () => {
    const entry = { ...good, funnyWrong: ["a", 2, null, "b"], origin: 5 };
    const r = await loadWords(json({ words: [entry] }), "ko-KR");
    expect(r).toEqual({ ok: true, words: [{ ...good, origin: undefined, funnyWrong: ["a", "b"] }] });
    expect(r.ok && "origin" in r.words[0]!).toBe(false);
  });

  it("count를 믿지 않는다", async () => {
    const r = await loadWords(json({ count: 99, words: [good] }), "ko-KR");
    expect(r.ok && r.words).toHaveLength(1);
  });
});

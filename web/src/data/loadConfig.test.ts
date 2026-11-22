import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@yk/quiz-core/config";
import { loadConfig } from "./loadConfig";

function respond(body: string, init: { status?: number } = {}): typeof fetch {
  return (async () => new Response(body, { status: init.status ?? 200 })) as typeof fetch;
}
const json = (value: unknown, init?: { status?: number }) => respond(JSON.stringify(value), init);

const full = {
  version: 3,
  features: { report: true, ask: true, ads: false },
  experiments: [{ id: "e1", enabled: true, variants: [{ name: "a", weight: 1 }, { name: "b", weight: 2 }] }],
  minShell: "1.2.0",
  api: "https://api.example.com",
};

describe("loadConfig", () => {
  it("올바른 설정을 그대로 읽는다", async () => {
    expect(await loadConfig(json(full), "ko-KR")).toEqual(full);
  });

  it("locale로 주소를 만들고 no-cache로 요청한다", async () => {
    const calls: [unknown, RequestInit | undefined][] = [];
    const fetchFn = (async (url: unknown, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(full));
    }) as typeof fetch;
    await loadConfig(fetchFn, "ko-KR");
    expect(calls).toEqual([["/config.ko-KR.json", { cache: "no-cache" }]]);
  });

  it("네트워크 오류면 기본값", async () => {
    const fetchFn = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    expect(await loadConfig(fetchFn, "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("fetchFn이 동기로 던져도 기본값", async () => {
    const fetchFn = (() => {
      throw new Error("sync");
    }) as typeof fetch;
    expect(await loadConfig(fetchFn, "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("OK가 아니면 기본값", async () => {
    expect(await loadConfig(json(full, { status: 404 }), "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("200인데 HTML이면 기본값", async () => {
    expect(await loadConfig(respond("<!doctype html><html></html>"), "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("최상위가 객체가 아니면 기본값", async () => {
    expect(await loadConfig(json([1]), "ko-KR")).toEqual(DEFAULT_CONFIG);
    expect(await loadConfig(json(null), "ko-KR")).toEqual(DEFAULT_CONFIG);
    expect(await loadConfig(json("x"), "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("모르는 칸은 읽지 않는다", async () => {
    const r = await loadConfig(json({ ...full, evil: 1 }), "ko-KR");
    expect(r).toEqual(full);
    expect("evil" in r).toBe(false);
  });

  it("칸마다 따로 기본값으로 돌아간다", async () => {
    const r = await loadConfig(
      json({ version: "3", features: { report: true, ask: "yes" }, experiments: "no", minShell: 4 }),
      "ko-KR",
    );
    expect(r).toEqual({
      version: 0,
      features: { report: true, ask: false, ads: false },
      experiments: [],
      api: "/api",
    });
  });

  it("version이 유한 숫자가 아니면 기본값", async () => {
    const r = await loadConfig(respond('{"version": 1e999}'), "ko-KR");
    expect(r.version).toBe(0);
  });

  it("api는 단일 / 또는 https://만 허용한다", async () => {
    const api = async (value: unknown) => (await loadConfig(json({ api: value }), "ko-KR")).api;
    expect(await api("//evil.example")).toBe("/api");
    expect(await api("/\\evil.com")).toBe("/api");
    expect(await api("/\t/evil.com")).toBe("/api");
    expect(await api("http://evil.example")).toBe("/api");
    expect(await api("javascript:alert(1)")).toBe("/api");
    expect(await api("api")).toBe("/api");
    expect(await api(5)).toBe("/api");
    expect(await api("/v2")).toBe("/v2");
    expect(await api("https://api.example.com")).toBe("https://api.example.com");
  });

  it("깨진 실험은 버리고 나머지는 남긴다", async () => {
    const ok = { id: "ok", enabled: false, variants: [{ name: "a", weight: 0 }] };
    const r = await loadConfig(
      json({
        experiments: [
          ok,
          { id: "neg", enabled: true, variants: [{ name: "a", weight: -1 }] },
          { id: "nan", enabled: true, variants: [{ name: "a", weight: "1" }] },
          { id: 1, enabled: true, variants: [] },
          { id: "noenabled", variants: [] },
          { id: "novariants", enabled: true },
          { id: "noname", enabled: true, variants: [{ weight: 1 }] },
          null,
        ],
      }),
      "ko-KR",
    );
    expect(r.experiments).toEqual([ok]);
  });

  it("본문을 읽다 실패하면 기본값", async () => {
    const fetchFn = (async () => ({ ok: true, text: () => Promise.reject(new Error("aborted")) })) as unknown as typeof fetch;
    expect(await loadConfig(fetchFn, "ko-KR")).toEqual(DEFAULT_CONFIG);
  });

  it("같은 id의 실험은 처음 것만 남긴다", async () => {
    const first = { id: "dup", enabled: true, variants: [{ name: "a", weight: 1 }] };
    const second = { id: "dup", enabled: false, variants: [{ name: "b", weight: 2 }] };
    const r = await loadConfig(json({ experiments: [first, second] }), "ko-KR");
    expect(r.experiments).toEqual([first]);
  });

  it("실험의 모르는 칸은 복사하지 않는다", async () => {
    const r = await loadConfig(
      json({ experiments: [{ id: "e", enabled: true, x: 1, variants: [{ name: "a", weight: 1, y: 2 }] }] }),
      "ko-KR",
    );
    expect(r.experiments).toEqual([{ id: "e", enabled: true, variants: [{ name: "a", weight: 1 }] }]);
  });

  it("돌려받은 설정을 바꿔도 DEFAULT_CONFIG는 그대로", async () => {
    const snapshot = structuredClone(DEFAULT_CONFIG);
    const failed = await loadConfig(respond("<html>"), "ko-KR");
    failed.features.ads = true;
    failed.experiments.push({ id: "x", enabled: true, variants: [] });
    failed.api = "/hacked";
    const partial = await loadConfig(json({}), "ko-KR");
    partial.features.report = true;
    partial.experiments.push({ id: "y", enabled: true, variants: [] });
    expect(DEFAULT_CONFIG).toEqual(snapshot);
    expect(failed).not.toBe(DEFAULT_CONFIG);
  });
});

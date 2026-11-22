import { describe, expect, it, vi } from "vitest";
import { shareEnvFrom } from "./shareEnv";

describe("shareEnvFrom", () => {
  it("share 도 clipboard 도 없으면 빈 환경", () => {
    expect(shareEnvFrom({})).toEqual({ webShare: undefined, clipboardWrite: undefined });
  });

  it("clipboard 에 writeText 가 없으면 clipboardWrite 는 없다", () => {
    expect(shareEnvFrom({ clipboard: {} }).clipboardWrite).toBeUndefined();
  });

  it("둘 다 있으면 this 를 맞춰 원본을 부른다", async () => {
    const nav = {
      share: vi.fn(async function (this: unknown) {
        expect(this).toBe(nav);
      }),
      clipboard: {
        writeText: vi.fn(async function (this: unknown) {
          expect(this).toBe(nav.clipboard);
        }),
      },
    };
    const env = shareEnvFrom(nav);
    await env.webShare?.({ text: "a" });
    await env.clipboardWrite?.("b");
    expect(nav.share).toHaveBeenCalledWith({ text: "a" });
    expect(nav.clipboard.writeText).toHaveBeenCalledWith("b");
  });
});

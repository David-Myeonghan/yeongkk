import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPng } from "./png";

const assets = join(import.meta.dirname, "..", "assets");
const load = (name: string) => readPng(readFileSync(join(assets, name)));

describe("png 읽기", () => {
  it("PNG 가 아니면 던진다 (서명 검사를 지우면 빨개진다)", () => {
    expect(() => readPng(Buffer.from("not a png at all, just text of some length........"))).toThrow();
  });
});

describe("자리표시 아이콘과 스플래시", () => {
  it("icon.png 는 1024x1024 이고 투명도가 없다 (iOS 가 투명 아이콘을 거절한다)", () => {
    const icon = load("icon.png");
    expect([icon.width, icon.height]).toEqual([1024, 1024]);
    expect(icon.hasTransparency).toBe(false);
  });

  it("adaptive-icon.png 는 1024x1024 이고 배경이 투명한 앞 그림이다", () => {
    const fg = load("adaptive-icon.png");
    expect([fg.width, fg.height]).toEqual([1024, 1024]);
    expect(fg.hasTransparency).toBe(true);
  });

  it("splash.png 는 정사각형이다", () => {
    const splash = load("splash.png");
    expect(splash.width).toBe(splash.height);
    expect(splash.width).toBeGreaterThanOrEqual(512);
  });
});

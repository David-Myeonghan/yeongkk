import { describe, expect, it } from "vitest";
import { shouldBlockEnter } from "./imeEnter";

describe("shouldBlockEnter", () => {
  it("조합 중 Enter 는 막는다", () => {
    expect(shouldBlockEnter({ key: "Enter", isComposing: true, keyCode: 13 })).toBe(true);
  });
  it("조합이 끝난 직후 Safari 의 keyCode 229 도 막는다", () => {
    expect(shouldBlockEnter({ key: "Enter", isComposing: false, keyCode: 229 })).toBe(true);
  });
  it("보통 Enter 는 막지 않는다", () => {
    expect(shouldBlockEnter({ key: "Enter", isComposing: false, keyCode: 13 })).toBe(false);
  });
  it("Enter 가 아니면 막지 않는다", () => {
    expect(shouldBlockEnter({ key: "a", isComposing: true, keyCode: 229 })).toBe(false);
  });
});

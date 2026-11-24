import { describe, expect, it } from "vitest";
import { hostKind } from "./hostKind";

describe("hostKind", () => {
  it("앱 소개가 있으면 app", () => {
    expect(hostKind({ protocol: 1, appVersion: "1.0.0", platform: "ios", capabilities: {} })).toBe("app");
  });
  it("없으면 browser", () => {
    expect(hostKind(null)).toBe("browser");
  });
});

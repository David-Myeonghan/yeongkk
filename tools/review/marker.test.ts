import { describe, expect, it } from "vitest";
import { parseMarker, renderMarker } from "./marker";

const SHA = "a".repeat(40);

describe("marker", () => {
  it.each(["full", "incremental"] as const)("만든 표지를 다시 읽으면 같은 값이다: %s", (mode) => {
    expect(parseMarker(renderMarker(SHA, mode))).toEqual({ headSha: SHA, mode });
  });

  it("줄 끝 공백은 받아들인다", () => {
    expect(parseMarker(`${renderMarker(SHA, "full")}  `)).toEqual({ headSha: SHA, mode: "full" });
  });

  it("40자 16진 sha 가 아니거나 모르는 mode 거나 뒤에 글이 붙으면 거절한다", () => {
    expect(parseMarker(renderMarker("abc123", "full"))).toBeUndefined();
    expect(parseMarker(`<!-- yk-review head_sha=${SHA} mode=both -->`)).toBeUndefined();
    expect(parseMarker(`${renderMarker(SHA, "full")} 덧붙임`)).toBeUndefined();
    expect(parseMarker("")).toBeUndefined();
  });
});

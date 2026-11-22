import { RESULT_COPY, resultTier } from "@yk/quiz-core/score";
import { describe, expect, it } from "vitest";
import { shareDataFor } from "./shareData";

describe("shareDataFor", () => {
  it("제목·글·주소를 만든다", () => {
    const data = shareDataFor(7, 10, "https://example.test");
    expect(data.title).toBe("뭔말이야");
    expect(data.text).toBe(`7점 — ${RESULT_COPY["ko-KR"][resultTier(7, 10)]}`);
    expect(data.url).toBe("https://example.test/?r=7");
  });

  it("점수는 맞힌 개수 그대로", () => {
    expect(shareDataFor(0, 10, "https://a.test").url).toBe("https://a.test/?r=0");
    expect(shareDataFor(10, 10, "https://a.test").text?.startsWith("10점 — ")).toBe(true);
  });
});

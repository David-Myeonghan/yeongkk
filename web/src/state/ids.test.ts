import { describe, expect, it } from "vitest";
import { newRoundId } from "./ids";

describe("newRoundId", () => {
  it("randomUUID 가 있으면 그것을 쓴다", () => {
    expect(newRoundId({ randomUUID: () => "a-b-c-d-e", getRandomValues: (a) => a })).toBe("a-b-c-d-e");
  });

  it("randomUUID 가 없으면 getRandomValues 로 32자리 16진수", () => {
    const id = newRoundId({
      getRandomValues: <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint8Array) array.forEach((_, i) => (array[i] = i * 17));
        return array;
      },
    });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id.startsWith("0011223344")).toBe(true);
  });

  it("randomUUID 가 던지면 getRandomValues 로 넘어간다", () => {
    const id = newRoundId({
      randomUUID: () => {
        throw new Error("insecure context");
      },
      getRandomValues: (a) => a,
    });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

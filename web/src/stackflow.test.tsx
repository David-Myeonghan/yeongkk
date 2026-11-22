import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { Stack } from "./stackflow";

afterEach(() => vi.restoreAllMocks());

it("renders Home inside StrictMode without console errors", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const html = renderToString(
    <StrictMode>
      <Stack />
    </StrictMode>,
  );
  expect(html).toContain("뭔말이야");
  expect(html).toContain("시작");
  expect(error).not.toHaveBeenCalled();
});

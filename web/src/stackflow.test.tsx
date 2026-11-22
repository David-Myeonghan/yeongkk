import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AppDataProvider } from "./app/AppData";
import type { KeyValue } from "./state/progress";
import { Stack } from "./stackflow";

afterEach(() => vi.restoreAllMocks());

const store: KeyValue = { get: () => null, set: () => {}, remove: () => {} };

it("renders Home (loading) inside StrictMode without console errors", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchFn = vi.fn<typeof fetch>(() => new Promise(() => {}));
  const html = renderToString(
    <StrictMode>
      <AppDataProvider fetchFn={fetchFn} store={store}>
        <Stack />
      </AppDataProvider>
    </StrictMode>,
  );
  expect(html).toContain("뭔말이야");
  expect(html).toContain("단어를 불러오는 중이에요.");
  expect(html).toContain('aria-live="polite"');
  expect(html.match(/<h1/g)).toHaveLength(1);
  expect(error).not.toHaveBeenCalled();
});

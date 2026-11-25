import { expect, test } from "@playwright/test";

test("/privacy/ 는 앱이 아니라 정적 방침 페이지를 준다", async ({ page }) => {
  const response = await page.goto("/privacy/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("뭔말이야 개인정보 처리방침");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("뭔말이야 개인정보 처리방침");
  await expect(page.locator("#root")).toHaveCount(0);
  await expect(page.getByText(/개인정보에 관한 문의와 삭제 요청/)).toBeVisible();
});

test("방침 페이지는 스크립트 없이 오고 밖으로 요청하지 않는다", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/privacy/");
  expect(requests).toEqual(["/privacy/"]);
  expect(await page.locator("script").count()).toBe(0);
});

test("알 수 없는 경로는 여전히 앱(SPA)으로 간다", async ({ page }) => {
  await page.goto("/nothing-here");
  await expect(page.locator("#root")).toHaveCount(1);
});

import { expect, test } from "@playwright/test";
import { stubNetwork } from "./support";

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

test("홈의 처리방침 링크로 가고, 돌아가기 링크로 홈에 돌아온다", async ({ context, page }) => {
  await stubNetwork(context);
  await page.goto("/");
  const link = page.getByRole("link", { name: "개인정보 처리방침" });
  await expect(link).toHaveAttribute("href", "/privacy/");
  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("뭔말이야 개인정보 처리방침");
  const back = page.getByRole("link", { name: "← 뭔말이야로 돌아가기" });
  await expect(back).toHaveCount(2);
  await back.first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "뭔말이야" })).toBeVisible();
});

test("처리방침 링크는 단어를 못 받은 홈에서도 보인다", async ({ context, page }) => {
  await stubNetwork(context, { failWords: true });
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("link", { name: "개인정보 처리방침" })).toBeVisible();
});

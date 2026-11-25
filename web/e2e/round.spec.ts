import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { PROTOCOL_VERSION } from "../../bridge/protocol";
import { RESULT_COPY } from "../../quiz-core/score";
import { stubNetwork, type StubNetworkOptions } from "./support";

const TOTAL = 10;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TIER_LINES = RESULT_COPY["ko-KR"].map(escapeRegExp);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const guardNetwork = (page: Page) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && !LOCAL_HOSTS.has(url.hostname)) outside.push(request.url());
  });
  return outside;
};

async function open(context: BrowserContext, page: Page, options: StubNetworkOptions = {}) {
  const outside = guardNetwork(page);
  const net = await stubNetwork(context, options);
  await page.goto("/");
  return { outside, net };
}

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const choices = (page: Page) => page.getByRole("group", { name: "보기" }).getByRole("button");

// 위에 없는 화면은 inert 라 보조 기술에서 빠진다. inert 밖에서 보이는 제목만 센다.
const liveHeadings = (page: Page) => page.locator("h1:not([inert] *, [inert])");

// 화면이 바뀌는 동안은 앞 화면이 잠깐 남는다. 자리 잡으면 제목은 하나여야 한다.
const settled = (page: Page) => expect(heading(page)).toHaveCount(1);

async function onQuestion(page: Page, number: number) {
  await expect(heading(page).filter({ hasText: /일까요\?/ })).toHaveCount(1);
  await settled(page);
  await expect(page.getByText(`${number} / ${TOTAL}`, { exact: true })).toBeVisible();
}

async function answerFirst(page: Page, number: number) {
  await onQuestion(page, number);
  await choices(page).first().click();
}

async function nextCard(page: Page, number: number) {
  await page.getByRole("button", { name: number === TOTAL ? "결과 보기" : "다음" }).click();
  expect(await liveHeadings(page).count()).toBeLessThanOrEqual(1);
}

async function playRound(page: Page, count = TOTAL) {
  await page.getByRole("button", { name: "시작" }).click();
  for (let n = 1; n <= count; n++) {
    await answerFirst(page, n);
    await nextCard(page, n);
  }
}

test("한 판을 끝까지", async ({ context, page }) => {
  test.slow();
  const { outside } = await open(context, page);
  await playRound(page);

  await expect(heading(page).filter({ hasText: `${TOTAL}문제 중` })).toHaveCount(1);
  await settled(page);
  await expect(page.getByText(new RegExp(`^\\d+ / ${TOTAL}$`))).toBeVisible();
  const tier = new RegExp(`^(${TIER_LINES.join("|")})$`);
  await expect(page.getByText(tier)).toBeVisible();
  await expect(page.getByRole("button", { name: /월요일/ })).toHaveCount(0);
  expect(outside).toEqual([]);
});

test("5번째에서 새로 고침", async ({ context, page }) => {
  test.slow();
  const { outside } = await open(context, page);
  await playRound(page, 4);

  await onQuestion(page, 5);
  const prompt = await heading(page).innerText();
  const before = await choices(page).allInnerTexts();
  expect(before).toHaveLength(4);

  await page.reload();
  await page.getByRole("button", { name: `이어 풀기 (4/${TOTAL})` }).click();

  await onQuestion(page, 5);
  expect(await heading(page).innerText()).toBe(prompt);
  expect(await choices(page).allInnerTexts()).toEqual(before);
  expect(outside).toEqual([]);
});

test("판 도중 6시간이 지나면 처음 화면에서 알려 준다", async ({ context, page }) => {
  await page.clock.install({ time: new Date() });
  await page.clock.resume();
  await open(context, page);
  await page.getByRole("button", { name: "시작" }).click();
  await onQuestion(page, 1);

  await page.clock.setSystemTime(new Date(Date.now() + 7 * 3_600_000));
  await choices(page).first().click();

  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  await expect(page.getByRole("main").getByText("시간이 지나서 새로 시작해요.")).toBeVisible();
});

test("단어 요청 실패", async ({ context, page }) => {
  const { outside, net } = await open(context, page, { failWords: true });

  await expect(page.getByText("단어를 못 받았어요. 연결을 확인해 주세요.")).toBeVisible();
  const retry = page.getByRole("button", { name: "다시" });
  await expect(retry).toBeVisible();

  net.setWordsFailing(false);
  await retry.click();
  await expect(page.getByRole("button", { name: "시작" })).toBeVisible();
  expect(outside).toEqual([]);
});

test("이벤트는 화면을 막지 않는다", async ({ context, page }) => {
  test.slow();
  let answered = 0;
  const { outside, net } = await open(context, page, {
    api: (route) => {
      if (route.request().url().includes("/api/events")) return new Promise<void>(() => {});
      answered += 1;
      return route.fulfill({ status: 204 });
    },
  });
  const eventsRequest = page.waitForRequest(/\/api\/events/);
  await playRound(page);
  await expect(heading(page).filter({ hasText: `${TOTAL}문제 중` })).toHaveCount(1);
  await settled(page);
  await eventsRequest;
  await expect.poll(() => net.apiCalls.filter((c) => c === "POST /api/events").length).toBeGreaterThanOrEqual(1);
  expect(answered).toBe(0);
  await expect(page.getByRole("button", { name: "다시 하기" })).toBeEnabled();
  expect(outside).toEqual([]);
});

test.describe("공유", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("공유 — 복사", async ({ context, page }) => {
    test.slow();
    await context.addInitScript(`Object.defineProperty(navigator, "share", { value: undefined, configurable: true });`);
    const { outside } = await open(context, page);
    await playRound(page);

    await page.getByRole("button", { name: "공유하기" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: "복사했어요" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("점 — ");
    expect(copied).toContain("/?r=");
    expect(outside).toEqual([]);
  });
});

// 앱 껍데기를 흉내 낸다. 웹이 보내는 notify 요청을 window.__notifyCalls 에 쌓고, 정해 둔 대로 답한다.
type FakeApp = { grantOnSchedule: boolean; statusFails?: boolean; scheduled?: boolean };

const fakeAppScript = (app: FakeApp) => `(() => {
  const app = ${JSON.stringify(app)};
  const calls = [];
  window.__notifyCalls = calls;
  const info = { protocol: ${PROTOCOL_VERSION}, appVersion: "0.0.0", platform: "ios", capabilities: { notify: 1 } };
  const send = (id, ok, result) => setTimeout(() => window.__YK_BRIDGE__.receive(JSON.stringify(
    ok ? { v: ${PROTOCOL_VERSION}, kind: "response", id, ok, result } : { v: ${PROTOCOL_VERSION}, kind: "response", id, ok, error: { code: "FAILED" } })), 0);
  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify(info),
    postMessage: (raw) => {
      const msg = JSON.parse(raw);
      if (msg.name !== "notify") return send(msg.id, false);
      const action = msg.payload.action;
      calls.push(action);
      if (action === "status" && app.statusFails) return send(msg.id, false);
      if (action === "schedule-weekly") app.scheduled = app.grantOnSchedule;
      if (action === "cancel") app.scheduled = false;
      send(msg.id, true, { granted: app.grantOnSchedule, scheduled: Boolean(app.scheduled) });
    },
  };
})();`;

const notifyCalls = (page: Page) => page.evaluate(() => (window as unknown as { __notifyCalls: string[] }).__notifyCalls);

test.describe("월요일 알림", () => {
  test("켜고 끈다", async ({ context, page }) => {
    test.slow();
    await context.addInitScript(fakeAppScript({ grantOnSchedule: true }));
    const { outside } = await open(context, page);
    await playRound(page);

    await page.getByRole("button", { name: "월요일에 알려 줄까요?" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: "월요일에 알려 줄게요" })).toBeVisible();
    await page.getByRole("button", { name: "알림 끄기" }).click();
    await expect(page.getByRole("button", { name: "월요일에 알려 줄까요?" })).toBeVisible();
    expect(await notifyCalls(page)).toEqual(["status", "schedule-weekly", "cancel"]);
    expect(outside).toEqual([]);
  });

  test("이미 켜져 있으면 켜진 상태로 보인다", async ({ context, page }) => {
    test.slow();
    await context.addInitScript(fakeAppScript({ grantOnSchedule: true, scheduled: true }));
    await open(context, page);
    await playRound(page);

    await expect(page.getByRole("paragraph").filter({ hasText: "월요일에 알려 줄게요" })).toBeVisible();
    await expect(page.getByRole("button", { name: "월요일에 알려 줄까요?" })).toHaveCount(0);
  });

  test("허용하지 않으면 설정 안내만 보이고 다시 묻지 않는다", async ({ context, page }) => {
    test.slow();
    await context.addInitScript(fakeAppScript({ grantOnSchedule: false }));
    await open(context, page);
    await playRound(page);

    await page.getByRole("button", { name: "월요일에 알려 줄까요?" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: "기기 설정에서 알림이 꺼져 있어요" })).toBeVisible();
    await expect(page.getByRole("button", { name: /월요일/ })).toHaveCount(0);
    expect(await notifyCalls(page)).toEqual(["status", "schedule-weekly"]);
  });

  test("앱이 status 에 실패하면 조용히 없다", async ({ context, page }) => {
    test.slow();
    await context.addInitScript(fakeAppScript({ grantOnSchedule: true, statusFails: true }));
    await open(context, page);
    await playRound(page);

    await expect(page.getByRole("button", { name: "공유하기" })).toBeVisible();
    await expect.poll(() => notifyCalls(page)).toEqual(["status"]);
    await expect(page.getByRole("button", { name: /월요일/ })).toHaveCount(0);
    await expect(page.getByText(/알림/)).toHaveCount(0);
  });
});

/* global console, process, fetch, setTimeout, URL, localStorage, document */
// 이미 빌드된 web/dist 를 vite preview 로 띄우고 화면별 PNG 를 web/e2e/__screens__/ 에 남긴다.
// 사용: npm run build -w web && node web/e2e/screenshots.mjs
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const webDir = fileURLToPath(new URL("..", import.meta.url));
const outDir = fileURLToPath(new URL("./__screens__/", import.meta.url));
const fixture = (name) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
const KEY = "yk.progress.v1";
const NOW = new Date("2026-11-23T10:00:00+09:00");
const PHONE = { width: 390, height: 844 };
const SMALL = { width: 320, height: 568 };
const SETTLE_MS = 700;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // 아직 안 떴다
    }
    await sleep(100);
  }
  throw new Error(`preview 가 뜨지 않았어요: ${url}`);
}

const words = JSON.parse(await fixture("words.ko-KR.json")).words;
const wordsBody = await fixture("words.ko-KR.json");
const configBody = await fixture("config.ko-KR.json");
const NEW_FIRST = ["god-saeng", ...words.map((w) => w.id).filter((id) => id !== "god-saeng").slice(0, 9)];

function progress(roundId, wordIds, answered) {
  return {
    roundId,
    wordIds,
    answers: wordIds.slice(0, answered).map((wordId, i) => ({ wordId, choice: 0, correct: i % 3 !== 2 })),
    startedAt: NOW.getTime() - 60_000,
  };
}

async function openPage(browser, base, { colorScheme, viewport, failWords = false, initScript }) {
  const context = await browser.newContext({
    viewport,
    colorScheme,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  if (initScript) await page.addInitScript(initScript);
  await page.clock.setFixedTime(NOW);
  await page.route("**/words.ko-KR.json", (route) =>
    failWords ? route.abort() : route.fulfill({ contentType: "application/json", body: wordsBody }),
  );
  await page.route("**/config.ko-KR.json", (route) => route.fulfill({ contentType: "application/json", body: configBody }));
  await page.goto(base);
  return { context, page };
}

async function withProgress(page, base, value) {
  await page.evaluate(([key, json]) => localStorage.setItem(key, json), [KEY, JSON.stringify(value)]);
  await page.goto(base);
}

async function resume(page) {
  await page.getByRole("button", { name: /이어 풀기/ }).click();
  await sleep(SETTLE_MS);
}

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}${name}.png` });
  console.log(`saved ${name}.png`);
}

async function findNewMeaningRound(page, base) {
  for (let k = 0; k < 40; k++) {
    const value = progress(`shot-${k}`, NEW_FIRST, 0);
    await withProgress(page, base, value);
    await resume(page);
    const heading = await page.locator("h1").last().innerText();
    if (heading.includes("NEW") && heading.includes("무슨 뜻일까요")) return value;
  }
  throw new Error("NEW + 뜻 고르기 문제를 만드는 roundId 를 못 찾았어요");
}

async function shootPhone(browser, base, colorScheme) {
  const s = (name) => `${name}-${colorScheme}`;

  {
    const { context, page } = await openPage(browser, base, { colorScheme, viewport: PHONE });
    await page.getByRole("button", { name: "시작" }).waitFor();
    await shot(page, s("home-ready"));

    await withProgress(page, base, progress("resume", NEW_FIRST, 3));
    await page.getByRole("button", { name: /이어 풀기/ }).waitFor();
    await shot(page, s("home-resume"));

    const round = await findNewMeaningRound(page, base);
    await shot(page, s("question-new-meaning"));

    await page.locator('[role="group"] button').first().click();
    await sleep(120);
    await shot(page, s("question-tapped"));
    await sleep(SETTLE_MS + 400);
    const firstRight = (await page.getByText("맞았어요").count()) > 0;
    const answerText = (await page.getByText(/^정답: /).innerText()).replace(/^정답: /, "");
    await shot(page, s(firstRight ? "wordcard-correct" : "wordcard-wrong"));

    await withProgress(page, base, round);
    await resume(page);
    const buttons = page.locator('[role="group"] button');
    const texts = await buttons.allInnerTexts();
    const target = texts.findIndex((t) => (firstRight ? t.trim() !== answerText : t.trim() === answerText));
    await buttons.nth(target).click();
    await sleep(SETTLE_MS + 400);
    await shot(page, s(firstRight ? "wordcard-wrong" : "wordcard-correct"));

    await withProgress(page, base, progress("result", NEW_FIRST, 9));
    await resume(page);
    await page.locator('[role="group"] button').first().click();
    await sleep(SETTLE_MS + 400);
    await page.getByRole("button", { name: "결과 보기" }).click();
    await sleep(SETTLE_MS);
    await shot(page, s("result"));
    await context.close();
  }

  {
    const { context, page } = await openPage(browser, base, { colorScheme, viewport: PHONE, failWords: true });
    await page.getByRole("button", { name: "다시" }).waitFor();
    await shot(page, s("home-failed-network"));
    await context.close();
  }
}

const NO_SHARE_COPY_OK = `
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.resolve() }, configurable: true });
`;
const NO_SHARE_NO_COPY = `
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
`;

async function shootShare(browser, base) {
  for (const [name, initScript] of [
    ["result-share-copied-light", NO_SHARE_COPY_OK],
    ["result-share-manual-light", NO_SHARE_NO_COPY],
  ]) {
    const { context, page } = await openPage(browser, base, { colorScheme: "light", viewport: PHONE, initScript });
    await page.getByRole("button", { name: "시작" }).waitFor();
    await withProgress(page, base, progress("result", NEW_FIRST, 9));
    await resume(page);
    await page.locator('[role="group"] button').first().click();
    await sleep(SETTLE_MS + 400);
    await page.getByRole("button", { name: "결과 보기" }).click();
    await sleep(SETTLE_MS);
    await page.getByRole("button", { name: "공유하기" }).click();
    await sleep(300);
    await shot(page, name);
    await context.close();
  }
}

async function shootSmall(browser, base) {
  const { context, page } = await openPage(browser, base, { colorScheme: "light", viewport: SMALL });
  await page.getByRole("button", { name: "시작" }).waitFor();
  await findNewMeaningRound(page, base);
  await shot(page, "question-320-light");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`320px horizontal overflow: ${overflow}px`);
  await context.close();
}

await mkdir(outDir, { recursive: true });
const port = await freePort();
const base = `http://127.0.0.1:${port}/`;
const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: webDir,
  stdio: ["ignore", "ignore", "inherit"],
});

let browser;
try {
  await waitForServer(base);
  browser = await chromium.launch();
  await shootPhone(browser, base, "light");
  await shootPhone(browser, base, "dark");
  await shootSmall(browser, base);
  await shootShare(browser, base);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
}

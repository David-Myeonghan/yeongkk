/* global fetch, setTimeout, URL */
// 화면 스크립트와 Playwright 시험이 같이 쓰는 도우미: preview 띄우기, 가짜 데이터 · API 막기.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

export const webDir = fileURLToPath(new URL("..", import.meta.url));
const fixture = (name) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

export const wordsBody = await fixture("words.ko-KR.json");
export const configBody = await fixture("config.ko-KR.json");
export const words = JSON.parse(wordsBody).words;

// Chromium 은 sendBeacon 을 page.route 로 못 가로챈다. 밖으로 나가지 않게 막는다.
export const NO_NETWORK_BEACON = `navigator.sendBeacon = () => true;`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function freePort() {
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

/** 이미 빌드된 web/dist 를 빈 포트에 띄운다. */
export async function startPreview() {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/`;
  const child = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: webDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitForServer(base);
  return { base, stop: () => child.kill("SIGTERM") };
}

/**
 * 단어 · 설정을 가짜 파일로, /api/** 를 204 로 막고, sendBeacon 을 끈다.
 * apiCalls 배열에 요청을 적는다. `api` 가 함수면 /api/** 를 그 함수가 맡는다. 반환값: setWordsFailing(bool).
 */
export async function stubNetwork(context, { failWords = false, api, apiCalls = [] } = {}) {
  let wordsFailing = failWords;
  await context.addInitScript(NO_NETWORK_BEACON);
  await context.route("**/words.ko-KR.json", (route) =>
    wordsFailing ? route.abort() : route.fulfill({ contentType: "application/json", body: wordsBody }),
  );
  await context.route("**/config.ko-KR.json", (route) => route.fulfill({ contentType: "application/json", body: configBody }));
  await context.route("**/api/**", (route) => {
    apiCalls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return api ? api(route) : route.fulfill({ status: 204 });
  });
  return {
    setWordsFailing: (value) => {
      wordsFailing = value;
    },
  };
}

// 화면 스크립트와 Playwright 시험이 같이 쓰는 도우미: preview 띄우기, 가짜 데이터 · API 막기.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Route } from "@playwright/test";
import type { Word } from "../../quiz-core/types";

export const webDir = fileURLToPath(new URL("..", import.meta.url));
const fixture = (name: string) => readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

export const wordsBody = await fixture("words.ko-KR.json");
export const configBody = await fixture("config.ko-KR.json");
export const words = (JSON.parse(wordsBody) as { words: Word[] }).words;

// Chromium 은 sendBeacon 을 page.route 로 못 가로챈다. 밖으로 나가지 않게 막는다.
export const NO_NETWORK_BEACON = `navigator.sendBeacon = () => true;`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("빈 포트를 얻지 못했어요"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(url: string) {
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
export async function startPreview(): Promise<{ base: string; stop: () => boolean }> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}/`;
  const child = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: webDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitForServer(base);
  return { base, stop: () => child.kill("SIGTERM") };
}

export interface StubNetworkOptions {
  failWords?: boolean;
  api?: (route: Route) => Promise<void>;
  apiCalls?: string[];
}

/**
 * 단어 · 설정을 가짜 파일로, /api/** 를 204 로 막고, sendBeacon 을 끈다.
 * apiCalls 배열에 요청을 적는다. `api` 가 함수면 /api/** 를 그 함수가 맡는다. 반환값: apiCalls, setWordsFailing(bool).
 */
export async function stubNetwork(
  context: BrowserContext,
  { failWords = false, api, apiCalls = [] }: StubNetworkOptions = {},
) {
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
    apiCalls,
    setWordsFailing: (value: boolean) => {
      wordsFailing = value;
    },
  };
}

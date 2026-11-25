import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { THEME } from "../src/theme";

const ACCENT = THEME.light.accent;
const ON_ACCENT = THEME.light.onAccent;
const SIZE = 1024;
const NAME = "뭔말";

const FONT = `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif`;

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${body}</svg>`;

const label = (fontSize: number): string =>
  `<text x="${SIZE / 2}" y="${SIZE / 2}" font-family="${FONT}" font-weight="800" font-size="${fontSize}" fill="${ON_ACCENT}" text-anchor="middle" dominant-baseline="central" letter-spacing="-8">${NAME}</text>`;

export interface Asset {
  file: string;
  svg: string;
  transparent: boolean;
}

// 안드로이드 적응형 아이콘은 가운데 66%만 항상 보인다. 글자는 그 안(약 600px)에 둔다.
export const ASSETS: readonly Asset[] = [
  { file: "icon.png", svg: svg(`<rect width="${SIZE}" height="${SIZE}" fill="${ACCENT}"/>${label(360)}`), transparent: false },
  { file: "adaptive-icon.png", svg: svg(label(270)), transparent: true },
  { file: "splash.png", svg: svg(`<rect width="${SIZE}" height="${SIZE}" rx="224" fill="${ACCENT}"/>${label(360)}`), transparent: true },
];

export async function generate(outDir: string): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
    const written: string[] = [];
    for (const asset of ASSETS) {
      await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${asset.svg}</body></html>`);
      const png = await page.screenshot({ type: "png", omitBackground: asset.transparent, clip: { x: 0, y: 0, width: SIZE, height: SIZE } });
      const path = join(outDir, asset.file);
      writeFileSync(path, png);
      written.push(path);
    }
    return written;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
  generate(out).then((files) => console.log(files.join("\n")));
}

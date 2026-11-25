import { originOf } from "./navigation";

export const DEFAULT_WEB_URL = "http://localhost:8787";

export interface WebTarget {
  url: string;
  origin: string;
}

export function parseWebUrl(raw: string | undefined): WebTarget {
  const url = raw === undefined || raw.trim() === "" ? DEFAULT_WEB_URL : raw.trim();
  const origin = originOf(url);
  if (origin === null) {
    throw new Error(`EXPO_PUBLIC_WEB_URL 은 http:// 또는 https:// 로 시작하는 올바른 주소여야 해요. 받은 값: ${JSON.stringify(raw)}`);
  }
  return { url, origin };
}

const target = parseWebUrl(process.env.EXPO_PUBLIC_WEB_URL);

export const WEB_URL = target.url;
export const WEB_ORIGIN = target.origin;

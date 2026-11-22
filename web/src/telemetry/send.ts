import type { QueuedEvent } from "./queue";

export interface Envelope {
  anonId: string;
  locale: string;
  host: "app" | "browser";
  appVersion?: string;
}

const APP_VERSION = /^[0-9A-Za-z.+-]{1,32}$/;

export const eventsUrl = (api: string): string => `${api.replace(/\/+$/, "")}/events`;

export function buildBody(envelope: Envelope, events: QueuedEvent[]): string {
  const { anonId, locale, host, appVersion } = envelope;
  return JSON.stringify({
    anonId,
    locale,
    host,
    ...(appVersion !== undefined && APP_VERSION.test(appVersion) ? { appVersion } : {}),
    events,
  });
}

/** 204 · 400 · 413 은 서버가 이 묶음을 다시는 안 받으니 보낸 것으로 친다(버림). 나머지는 나중에 다시. */
export async function sendEvents(fetchFn: typeof fetch, api: string, envelope: Envelope, events: QueuedEvent[]): Promise<boolean> {
  try {
    const res = await fetchFn(eventsUrl(api), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildBody(envelope, events),
      keepalive: true,
    });
    return res.status === 204 || res.status === 400 || res.status === 413;
  } catch {
    return false;
  }
}

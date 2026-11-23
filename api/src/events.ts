import { EVENT_NAMES } from "../../quiz-core/events";
import { insertEvents, type EventRow } from "./db";
import { noContent, type Handler } from "./http";
import { dayOf } from "./time";
import {
  isObject, parseAppVersion, parseHost, readIdentified, badRequest, tooLarge,
} from "./validate";

const MAX_EVENTS = 50;
const MAX_PROPS = 20;
const MAX_STRING = 200;
const PROP_KEY = /^[a-z][A-Za-z0-9_]{0,31}$/;

const isEventName = (value: unknown): value is string =>
  typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);

const sanitizeProps = (raw: unknown): string | null => {
  if (!isObject(raw)) return null;
  const kept: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_PROPS) break;
    if (!PROP_KEY.test(key)) continue;
    const ok =
      (typeof value === "string" && [...value].length <= MAX_STRING && !value.includes("@")) ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean";
    if (!ok) continue;
    kept[key] = value;
    count += 1;
  }
  return count === 0 ? null : JSON.stringify(kept);
};

export const postEvents: Handler = async (request, env, now) => {
  const read = await readIdentified(request);
  if (!read.ok) return read.response;
  const { anonId, locale, body } = read.value;
  const host = parseHost(body.host);
  if (host === null || !Array.isArray(body.events)) return badRequest();
  if (body.events.length > MAX_EVENTS) return tooLarge();

  const at = now();
  const receivedAt = new Date(at).toISOString();
  const day = dayOf(at);
  const appVersion = parseAppVersion(body.appVersion);
  const rows: EventRow[] = [];
  for (const item of body.events as unknown[]) {
    if (!isObject(item) || !isEventName(item.name)) continue;
    if (typeof item.at !== "number" || !Number.isFinite(item.at)) continue;
    rows.push({ receivedAt, day, anonId, name: item.name, locale, host, appVersion, props: sanitizeProps(item.props) });
  }
  await insertEvents(env, rows);
  return noContent();
};

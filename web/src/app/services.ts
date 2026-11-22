import { DEFAULT_CONFIG } from "@yk/quiz-core/config";
import { getBridge } from "../platform/bridge";
import { newRoundId } from "../state/ids";
import { createRoundTracker } from "../state/rounds";
import { createStore } from "../state/storage";
import { getAnonId } from "../telemetry/anonId";
import { createTelemetry } from "../telemetry/events";
import { getLiveConfig } from "./liveConfig";

/** 앱 전체가 함께 쓰는 하나뿐인 객체들을 여기서만 만든다. */
export const appStore = createStore();

export const anonId = (): string => getAnonId(appStore, newRoundId);

const canBeacon = typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function";

export const telemetry = createTelemetry({
  store: appStore,
  anonId,
  fetchFn: (...args) => fetch(...args),
  beacon: canBeacon ? (url, body) => navigator.sendBeacon(url, body) : undefined,
  getApi: () => getLiveConfig()?.api ?? DEFAULT_CONFIG.api,
  getHost: () => {
    const info = getBridge().host();
    return info ? { host: "app", appVersion: info.appVersion } : { host: "browser" };
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
});

export const track = telemetry.track;

export const rounds = createRoundTracker({ track });

import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import type { Experiment } from "@yk/quiz-core/experiment";
import { isRecord, isString } from "./guards";

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toExperiment(raw: unknown): Experiment | null {
  if (!isRecord(raw)) return null;
  const { id, enabled, variants } = raw;
  if (!isString(id) || typeof enabled !== "boolean" || !Array.isArray(variants)) return null;
  const parsed: Experiment["variants"] = [];
  for (const v of variants) {
    if (!isRecord(v) || !isString(v.name)) return null;
    if (typeof v.weight !== "number" || !Number.isFinite(v.weight) || v.weight < 0) return null;
    parsed.push({ name: v.name, weight: v.weight });
  }
  return { id, enabled, variants: parsed };
}

function toApi(value: unknown): string {
  if (!isString(value)) return DEFAULT_CONFIG.api;
  const relative = value.startsWith("/") && !value.startsWith("//");
  return relative || value.startsWith("https://") ? value : DEFAULT_CONFIG.api;
}

function fromRaw(raw: unknown): RemoteConfig {
  const base = DEFAULT_CONFIG;
  if (!isRecord(raw)) return fromRaw({});
  const features = isRecord(raw.features) ? raw.features : {};
  const config: RemoteConfig = {
    version: typeof raw.version === "number" && Number.isFinite(raw.version) ? raw.version : base.version,
    features: {
      report: flag(features.report, base.features.report),
      ask: flag(features.ask, base.features.ask),
      ads: flag(features.ads, base.features.ads),
    },
    experiments: Array.isArray(raw.experiments)
      ? raw.experiments.map(toExperiment).filter((e): e is Experiment => e !== null)
      : [],
    api: toApi(raw.api),
  };
  if (isString(raw.minShell)) config.minShell = raw.minShell;
  return config;
}

export async function loadConfig(fetchFn: typeof fetch, locale: string): Promise<RemoteConfig> {
  try {
    const res = await fetchFn(`/config.${locale}.json`, { cache: "no-cache" });
    if (!res.ok) return fromRaw(undefined);
    const body: unknown = await res.json();
    return isRecord(body) ? fromRaw(body) : fromRaw(undefined);
  } catch {
    return fromRaw(undefined);
  }
}

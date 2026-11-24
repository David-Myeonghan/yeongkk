import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import type { Experiment } from "@yk/quiz-core/experiment";
import { isRecord, isSafeApiBase, isString } from "./guards";

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

function fromRaw(raw: Record<string, unknown>): RemoteConfig {
  const base = DEFAULT_CONFIG;
  const features = isRecord(raw.features) ? raw.features : {};
  const seen = new Set<string>();
  const experiments = Array.isArray(raw.experiments)
    ? raw.experiments.map(toExperiment).filter((e): e is Experiment => {
        if (e === null || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
    : [];
  const config: RemoteConfig = {
    version: typeof raw.version === "number" && Number.isFinite(raw.version) ? raw.version : base.version,
    features: {
      report: flag(features.report, base.features.report),
      ask: flag(features.ask, base.features.ask),
      ads: flag(features.ads, base.features.ads),
    },
    experiments,
    api: isSafeApiBase(raw.api) ? raw.api : base.api,
  };
  if (isString(raw.minShell)) config.minShell = raw.minShell;
  return config;
}

export async function loadConfig(fetchFn: typeof fetch, locale: string): Promise<RemoteConfig> {
  let text: string;
  try {
    const res = await fetchFn(`/config.${locale}.json`, { cache: "no-cache" });
    if (!res.ok) return fromRaw({});
    text = await res.text();
  } catch {
    return fromRaw({});
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fromRaw({});
  }
  return fromRaw(isRecord(body) ? body : {});
}

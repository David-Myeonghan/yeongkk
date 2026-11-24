import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RemoteConfig } from "../quiz-core/config";
import { P, type LoadedConfig, type Problem } from "./types";
import { schemaValidator } from "./schema";

export type { LoadedConfig };

const validateConfigSchema = schemaValidator("config.schema.json");
const LOCALE_FILE = /^[a-z]{2}-[A-Z]{2}\.json$/;

export function loadConfigs(root: string): LoadedConfig[] {
  const dir = join(root, "config", "remote");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(fileName => {
    const path = `config/remote/${fileName}`;
    try { return { path, fileName, data: JSON.parse(readFileSync(join(root, path), "utf8")) }; }
    catch (e) { return { path, fileName, data: undefined, parseError: String(e) }; }
  });
}

export function checkConfig(c: LoadedConfig): Problem[] {
  if (c.parseError !== undefined) return [P(c.path, "형식", `JSON 아님: ${c.parseError}`)];
  const out: Problem[] = [];
  if (!LOCALE_FILE.test(c.fileName)) out.push(P(c.path, "형식", "파일 이름은 <로케일>.json (예: ko-KR.json)"));
  const r = validateConfigSchema(c.data);
  if (!r.ok) {
    for (const e of r.errors) out.push(P(c.path, "형식", e));
    return out;
  }
  const cfg = c.data as RemoteConfig;
  const ids = new Set<string>();
  for (const exp of cfg.experiments) {
    if (ids.has(exp.id)) out.push(P(c.path, "실험", `실험 id 중복: ${exp.id}`)); else ids.add(exp.id);
    if (exp.variants.reduce((s, v) => s + v.weight, 0) === 0) out.push(P(c.path, "실험", `실험 ${exp.id} 가중치 합이 0`));
    const names = new Set<string>();
    for (const v of exp.variants) {
      if (names.has(v.name)) out.push(P(c.path, "실험", `실험 ${exp.id} 변형 이름 중복: ${v.name}`)); else names.add(v.name);
    }
    if (exp.id === "funny-wrong" && !(names.size === 2 && names.has("on") && names.has("off"))) {
      out.push(P(c.path, "실험", `실험 funny-wrong 의 변형 이름은 "on" 과 "off" 두 개여야 해요 (앱이 이 이름을 그대로 써요): ${[...names].join(", ")}`));
    }
  }
  return out;
}

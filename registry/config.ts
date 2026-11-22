import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import type { RemoteConfig } from "../quiz-core/config";
import type { LoadedConfig, Problem } from "./types";

export type { LoadedConfig };

const schema = JSON.parse(readFileSync(new URL("../schema/config.schema.json", import.meta.url), "utf8"));
const compiled = new Ajv2020({ allErrors: true }).compile(schema);

const P = (file: string, rule: string, message: string): Problem => ({ file, rule, message });
const LOCALE_FILE = /^[a-z]{2}-[A-Z]{2}\.json$/;

export function loadConfigs(root: string): LoadedConfig[] {
  const dir = join(root, "config", "remote");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(fileName => {
    const path = `config/remote/${fileName}`;
    let data: unknown;
    try { data = JSON.parse(readFileSync(join(root, path), "utf8")); }
    catch (e) { data = { __parseError: String(e) }; }
    return { path, fileName, data };
  });
}

export function checkConfig(c: LoadedConfig): Problem[] {
  const d = c.data as any;
  if (d && d.__parseError) return [P(c.path, "형식", `JSON 아님: ${d.__parseError}`)];
  const out: Problem[] = [];
  if (!LOCALE_FILE.test(c.fileName)) out.push(P(c.path, "형식", "파일 이름은 <로케일>.json (예: ko-KR.json)"));
  if (!compiled(d)) {
    for (const e of compiled.errors ?? []) out.push(P(c.path, "형식", `${e.instancePath || "/"} ${e.message ?? ""} ${JSON.stringify(e.params)}`));
    return out;
  }
  const cfg = d as RemoteConfig;
  const ids = new Set<string>();
  for (const exp of cfg.experiments) {
    if (ids.has(exp.id)) out.push(P(c.path, "실험", `실험 id 중복: ${exp.id}`)); else ids.add(exp.id);
    if (exp.variants.reduce((s, v) => s + v.weight, 0) === 0) out.push(P(c.path, "실험", `실험 ${exp.id} 가중치 합이 0`));
    const names = new Set<string>();
    for (const v of exp.variants) {
      if (names.has(v.name)) out.push(P(c.path, "실험", `실험 ${exp.id} 변형 이름 중복: ${v.name}`)); else names.add(v.name);
    }
  }
  return out;
}

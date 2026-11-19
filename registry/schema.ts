import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const schema = JSON.parse(readFileSync(new URL("../schema/word.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const compiled = ajv.compile(schema);

export function validateWordSchema(data: unknown): { ok: boolean; errors: string[] } {
  const ok = compiled(data) as boolean;
  const errors = (compiled.errors ?? []).map(e => `${e.instancePath || "/"} ${e.message ?? ""} ${JSON.stringify(e.params)}`);
  return { ok, errors };
}

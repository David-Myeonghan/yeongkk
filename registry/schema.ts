import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface SchemaResult { ok: boolean; errors: string[] }

export function schemaValidator(schemaFile: string): (data: unknown) => SchemaResult {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const compiled = ajv.compile(JSON.parse(readFileSync(new URL(`../schema/${schemaFile}`, import.meta.url), "utf8")));
  return data => {
    const ok = compiled(data) as boolean;
    const errors = (compiled.errors ?? []).map(e => `${e.instancePath || "/"} ${e.message ?? ""} ${JSON.stringify(e.params)}`);
    return { ok, errors };
  };
}

export const validateWordSchema = schemaValidator("word.schema.json");

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

function hasUnsafeChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}
const MAX_API_BASE_LENGTH = 200;

export function isSafeApiBase(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_API_BASE_LENGTH) return false;
  if (hasUnsafeChar(value)) return false;
  if (value.startsWith("/")) return value[1] !== "/";
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

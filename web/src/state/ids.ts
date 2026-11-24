type IdSource = Partial<Pick<Crypto, "randomUUID">> & Pick<Crypto, "getRandomValues">;

export function newRoundId(source: IdSource | undefined = globalThis.crypto): string {
  try {
    if (source?.randomUUID) return source.randomUUID();
  } catch {
    // 보안 컨텍스트가 아니면 randomUUID 가 없거나 던진다
  }
  const bytes = new Uint8Array(16);
  let filled = false;
  try {
    if (source) {
      source.getRandomValues(bytes);
      filled = true;
    }
  } catch {
    filled = false;
  }
  if (!filled) bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

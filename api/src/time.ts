const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const dayOf = (ms: number): string => new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);

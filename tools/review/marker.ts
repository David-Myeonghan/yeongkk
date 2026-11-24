import type { ReviewMode } from "./types";

export type Marker = { headSha: string; mode: ReviewMode };

const MARKER = /^<!-- yk-review head_sha=([0-9a-f]{40}) mode=(full|incremental) -->$/;

export function renderMarker(headSha: string, mode: ReviewMode): string {
  return `<!-- yk-review head_sha=${headSha} mode=${mode} -->`;
}

export function parseMarker(firstLine: string): Marker | undefined {
  const found = MARKER.exec(firstLine.trimEnd());
  const [, headSha, mode] = found ?? [];
  return headSha !== undefined && (mode === "full" || mode === "incremental") ? { headSha, mode } : undefined;
}

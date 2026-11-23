import type { AddedLines } from "./types";

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parseAddedLines(diff: string): AddedLines {
  const result: AddedLines = new Map();
  let current: Set<number> | undefined;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4);
      if (target === "/dev/null") {
        current = undefined;
        continue;
      }
      const path = target.replace(/^b\//, "");
      current = result.get(path) ?? new Set<number>();
      result.set(path, current);
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk === null || current === undefined) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let n = start; n < start + count; n += 1) current.add(n);
  }
  return result;
}

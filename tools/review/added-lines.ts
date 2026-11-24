import type { AddedLines } from "./types";

const HUNK = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseAddedLines(diff: string): AddedLines {
  const result: AddedLines = new Map();
  let current: Set<number> | undefined;
  let oldLeft = 0;
  let newLeft = 0;
  let nextLine = 0;
  for (const line of diff.split("\n")) {
    if (oldLeft > 0 || newLeft > 0) {
      const mark = line[0];
      if (mark === "+") {
        current?.add(nextLine);
        nextLine += 1;
        newLeft -= 1;
      } else if (mark === "-") oldLeft -= 1;
      else if (mark === " ") {
        nextLine += 1;
        oldLeft -= 1;
        newLeft -= 1;
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      const target = (line.slice(4).split("\t")[0] ?? "");
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
    if (hunk === null) continue;
    oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
    nextLine = Number(hunk[2]);
    newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
  }
  return result;
}

export function parseNameStatus(out: string): { changedFiles: string[]; deletedFiles: string[] } {
  const changedFiles: string[] = []; const deletedFiles: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf("\t");
    if (i < 0) continue;
    const status = line.slice(0, i).trim(); const file = line.slice(i + 1);
    (status.startsWith("D") ? deletedFiles : changedFiles).push(file);
  }
  return { changedFiles, deletedFiles };
}

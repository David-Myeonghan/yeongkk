import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadWords, loadBanned } from "./load";
import { parseNameStatus } from "./diff";
import { runAll, toMarkdown } from "./validate";

const root = process.cwd();
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || "HEAD";
const { changedFiles, deletedFiles } = base
  ? parseNameStatus(execFileSync("git", ["-c", "core.quotepath=false", "diff", "--name-status", "--no-renames", `${base}...${head}`], { encoding: "utf8" }))
  : { changedFiles: [], deletedFiles: [] };
const isBot = (process.env.HEAD_REF ?? "").startsWith("auto/");
const problems = runAll({ words: loadWords(root), banned: loadBanned(root), changedFiles, deletedFiles, isBot, root });
const md = toMarkdown(problems);
writeFileSync("check-report.md", md);
console.log(md);
process.exit(problems.length ? 1 : 0);

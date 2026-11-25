import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVACY_CONTACT } from "./contact";
import { policy } from "./content";
import { renderHtml, renderMarkdown } from "./render";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const OUTPUTS = {
  markdown: join(root, "docs", "privacy.md"),
  html: join(root, "web", "public", "privacy", "index.html"),
} as const;

export function build(contact: string): { markdown: string; html: string } {
  const doc = policy(contact);
  return { markdown: renderMarkdown(doc), html: renderHtml(doc) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = build(PRIVACY_CONTACT);
  if (process.argv.includes("--check")) {
    const same = readFileSync(OUTPUTS.markdown, "utf8") === out.markdown && readFileSync(OUTPUTS.html, "utf8") === out.html;
    if (!same) {
      console.error("docs/privacy.md 또는 web/public/privacy/index.html 이 tools/privacy 의 내용과 달라요. npm run privacy 를 돌리세요.");
      process.exit(1);
    }
  } else {
    mkdirSync(dirname(OUTPUTS.html), { recursive: true });
    writeFileSync(OUTPUTS.markdown, out.markdown);
    writeFileSync(OUTPUTS.html, out.html);
    console.log(`${OUTPUTS.markdown}\n${OUTPUTS.html}`);
  }
}

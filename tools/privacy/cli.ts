import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVACY_CONTACT, isPlaceholderContact } from "./contact";
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

export const CONTACT_ERROR =
  "개인정보 문의처가 자리표시(PRIVACY_CONTACT_PLACEHOLDER) 그대로예요. 이대로 배포하면 공개 방침 페이지에 자리표시가 보여요. tools/privacy/contact.ts 를 고치고 npm run privacy 를 돌린 뒤 합치세요.";

/** 배포 전 검사. 문의처가 자리표시이면 1, 아니면 0. */
export function requireContact(contact: string, report: (line: string) => void): number {
  if (!isPlaceholderContact(contact)) return 0;
  report(`::error::${CONTACT_ERROR}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--require-contact")) {
    process.exit(requireContact(PRIVACY_CONTACT, console.log));
  }
  const out = build(PRIVACY_CONTACT);
  mkdirSync(dirname(OUTPUTS.html), { recursive: true });
  writeFileSync(OUTPUTS.markdown, out.markdown);
  writeFileSync(OUTPUTS.html, out.html);
  console.log(`${OUTPUTS.markdown}\n${OUTPUTS.html}`);
}

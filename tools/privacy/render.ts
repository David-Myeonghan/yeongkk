import type { Block, PrivacyDoc } from "./content";

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const markdownBlock = (block: Block): string => ("p" in block ? block.p : block.ul.map((item) => `- ${item}`).join("\n"));

export function renderMarkdown(doc: PrivacyDoc): string {
  const parts = [`# ${doc.title}`, `최종 수정: ${doc.updated}`];
  for (const section of doc.sections) {
    parts.push(`## ${section.title}`, ...section.blocks.map(markdownBlock));
  }
  return `${parts.join("\n\n")}\n`;
}

const htmlBlock = (block: Block): string =>
  "p" in block
    ? `<p>${escapeHtml(block.p)}</p>`
    : `<ul>\n${block.ul.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}\n</ul>`;

// 색은 web/src/styles/theme.css.ts 의 값을 그대로 옮겼다. 스크립트도 외부 파일도 없는 한 장짜리 페이지다.
const STYLE = `
:root{color-scheme:light dark;--bg:#f5f4fa;--text:#17142a;--muted:#5d5873;--line:#d9d5e8;--accent:#5432e6}
@media (prefers-color-scheme:dark){:root{--bg:#15131d;--text:#f2f0f9;--muted:#aaa5bd;--line:#383349;--accent:#a897ff}}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Malgun Gothic",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
main{max-width:640px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:26px;line-height:1.25;margin:16px 0 4px}
h2{font-size:19px;line-height:1.3;margin:32px 0 8px;padding-top:16px;border-top:1px solid var(--line)}
p,li{margin:8px 0}
ul{padding-left:20px}
.updated{color:var(--muted);margin:0}
.back{margin:0}
.back a{color:var(--accent);display:inline-block;padding:12px 0}
.back.end{margin-top:32px}
`.trim();

const BACK = "← 뭔말이야로 돌아가기";

export function renderHtml(doc: PrivacyDoc): string {
  const body = doc.sections.map((s) => `<h2>${escapeHtml(s.title)}</h2>\n${s.blocks.map(htmlBlock).join("\n")}`).join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f4fa">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#15131d">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(doc.title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
<p class="back"><a href="/">${BACK}</a></p>
<h1>${escapeHtml(doc.title)}</h1>
<p class="updated">최종 수정: ${escapeHtml(doc.updated)}</p>
${body}
<p class="back end"><a href="/">${BACK}</a></p>
</main>
</body>
</html>
`;
}

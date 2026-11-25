const AUTHORITY = /^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*\.?|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/;
const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

export type NavigationDecision = "load" | "open-external" | "ignore";

export function originOf(url: string): string | null {
  const parts = /^(https?):\/\/([^/?#]*)/i.exec(url);
  if (parts === null) return null;
  const scheme = `${parts[1].toLowerCase()}:`;
  const authority = parts[2].toLowerCase();
  const match = AUTHORITY.exec(authority);
  if (match === null) return null;
  const port = match[1];
  if (port !== undefined && Number(port) > 65535) return null;
  const hostPart = port === undefined ? authority : authority.slice(0, authority.length - port.length - 1);
  const host = hostPart.endsWith(".") ? hostPart.slice(0, -1) : hostPart;
  if (host === "") return null;
  const keepPort = port !== undefined && port !== DEFAULT_PORTS[scheme];
  return `${scheme}//${host}${keepPort ? `:${port}` : ""}`;
}

export function isSameOrigin(url: string, webOrigin: string): boolean {
  const expected = originOf(webOrigin);
  return expected !== null && originOf(url) === expected;
}

export function decideNavigation(url: string, webOrigin: string): NavigationDecision {
  if (isSameOrigin(url, webOrigin)) return "load";
  return originOf(url) === null ? "ignore" : "open-external";
}

const withoutHash = (url: string): string => url.split("#")[0];

export function isMainDocumentFailure(eventUrl: string, mainUrl: string): boolean {
  return withoutHash(eventUrl) === withoutHash(mainUrl);
}

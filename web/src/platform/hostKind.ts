import type { HostInfo } from "@yk/bridge/protocol";

export type HostKind = "app" | "browser";

export const hostKind = (info: HostInfo | null): HostKind => (info ? "app" : "browser");

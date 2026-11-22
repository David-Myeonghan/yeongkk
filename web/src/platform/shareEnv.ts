import type { ShareData, ShareEnv } from "@yk/bridge/share";

export interface NavigatorLike {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

export function shareEnvFrom(nav: NavigatorLike): ShareEnv {
  const clipboard = nav.clipboard;
  return {
    webShare: nav.share?.bind(nav),
    clipboardWrite: clipboard?.writeText?.bind(clipboard),
  };
}

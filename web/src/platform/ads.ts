import type { WebBridge } from "@yk/bridge/web";
import type { RemoteConfig } from "@yk/quiz-core/config";
import { getBridge } from "./bridge";

export function createAdsSync(getBridgeFn: () => WebBridge): (visible: boolean) => void {
  let sent: boolean | null = null;
  return (visible) => {
    if (sent === visible) return;
    sent = visible;
    const bridge = getBridgeFn();
    void bridge
      .ready()
      .then(() => {
        if (bridge.has("ads", 1)) return bridge.call("ads", { visible });
        return undefined;
      })
      .catch(() => undefined);
  };
}

const syncAds = createAdsSync(getBridge);

export const syncAdsWithConfig = (config: RemoteConfig): void => syncAds(config.features.ads);

import Constants from "expo-constants";
import { Platform } from "react-native";
import { adsFromExtra, bannerUnitId } from "./adsConfig";
import { createConsentGate } from "./adsConsent";
import { createBannerStore } from "./bannerState";
import type { AdsDeps } from "./host";

export const adsConfig = adsFromExtra(Constants.expoConfig?.extra);
export const bannerStore = createBannerStore();

async function gather() {
  const { AdsConsent } = await import("react-native-google-mobile-ads");
  const info = await AdsConsent.gatherConsent();
  const gdprApplies = await AdsConsent.getGdprApplies();
  const choices = await AdsConsent.getUserChoices();
  return { canRequestAds: info.canRequestAds, gdprApplies, selectedPersonalised: choices.selectPersonalisedAds };
}

async function initialize() {
  const { default: mobileAds } = await import("react-native-google-mobile-ads");
  await mobileAds().initialize();
}

async function requestTracking() {
  const { requestTrackingPermissionsAsync } = await import("expo-tracking-transparency");
  return (await requestTrackingPermissionsAsync()).granted;
}

export const nativeAds: AdsDeps | undefined = adsConfig.enabled
  ? {
      consent: createConsentGate({ gather, initialize, requestTracking: Platform.OS === "ios" ? requestTracking : undefined }),
      show(nonPersonalized) {
        const unitId = bannerUnitId(adsConfig, Platform.OS, __DEV__);
        if (unitId === null) return false;
        bannerStore.set({ visible: true, unitId, nonPersonalized });
        return true;
      },
      hide: () => bannerStore.set({ visible: false }),
    }
  : undefined;

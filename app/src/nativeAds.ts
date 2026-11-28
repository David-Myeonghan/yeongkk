import Constants from "expo-constants";
import { Platform, TurboModuleRegistry } from "react-native";
import { adsFromExtra, adsModuleAvailable, bannerUnitId } from "./adsConfig";
import { createConsentGate } from "./adsConsent";
import { createBannerStore } from "./bannerState";
import type { AdsDeps } from "./host";

export const adsConfig = adsFromExtra(Constants.expoConfig?.extra);
export const bannerStore = createBannerStore();

async function library() {
  if (!adsModuleAvailable((name) => TurboModuleRegistry.get(name))) {
    console.warn("광고 네이티브 모듈이 이 빌드에 없어요. 광고를 켠 개발 빌드는 새로 만들어야 해요.");
    throw new Error("광고 네이티브 모듈이 이 빌드에 없어요");
  }
  return import("react-native-google-mobile-ads");
}

async function gather() {
  const { AdsConsent } = await library();
  const info = await AdsConsent.gatherConsent();
  const gdprApplies = await AdsConsent.getGdprApplies();
  const choices = await AdsConsent.getUserChoices();
  return { canRequestAds: info.canRequestAds, gdprApplies, selectedPersonalised: choices.selectPersonalisedAds };
}

async function initialize() {
  const { default: mobileAds } = await library();
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

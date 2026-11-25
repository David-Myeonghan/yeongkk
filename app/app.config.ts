import type { ExpoConfig } from "expo/config";
import pkg from "./package.json";

// 자리표시 값이다. 주인이 정하기 전에는 스토어용 빌드를 만들지 않는다.
const APP_IDENTIFIER = "app.example.yeongkk";

const config: ExpoConfig = {
  name: "뭔말이야",
  slug: "yeongkk",
  version: pkg.version,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: APP_IDENTIFIER, supportsTablet: false },
  android: { package: APP_IDENTIFIER },
};

export default config;

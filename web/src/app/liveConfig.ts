import type { RemoteConfig } from "@yk/quiz-core/config";

let current: RemoteConfig | null = null;

/** 받은 설정(또는 3초 뒤 기본 설정). 아직 안 왔으면 null. React 밖(전송 · 실험)이 읽는다. */
export const getLiveConfig = (): RemoteConfig | null => current;
export const setLiveConfig = (config: RemoteConfig): void => {
  current = config;
};

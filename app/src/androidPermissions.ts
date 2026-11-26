export const AD_ID = "com.google.android.gms.permission.AD_ID";

// 앱이 실제로 쓰는 권한. 막는 목록과 겹치면 시험이 깨진다.
export const KEPT_PERMISSIONS: readonly string[] = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK",
  "android.permission.VIBRATE",
];

// 앱 코드는 이 권한들을 쓰지 않는다. 템플릿(저장소 · 오버레이)이나 라이브러리(푸시 · 설치 경로 · 아이콘 배지)가 들고 온다.
const UNUSED: readonly string[] = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "com.google.android.c2dm.permission.RECEIVE",
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
  "android.permission.READ_APP_BADGE",
  "com.anddoes.launcher.permission.UPDATE_COUNT",
  "com.android.launcher.permission.INSTALL_SHORTCUT",
  "com.android.launcher.permission.UNINSTALL_SHORTCUT",
  "com.android.launcher.permission.READ_SETTINGS",
  "com.android.launcher.permission.WRITE_SETTINGS",
  "com.htc.launcher.permission.READ_SETTINGS",
  "com.htc.launcher.permission.UPDATE_SHORTCUT",
  "com.huawei.android.launcher.permission.CHANGE_BADGE",
  "com.huawei.android.launcher.permission.READ_SETTINGS",
  "com.huawei.android.launcher.permission.WRITE_SETTINGS",
  "com.majeur.launcher.permission.UPDATE_BADGE",
  "com.oppo.launcher.permission.READ_SETTINGS",
  "com.oppo.launcher.permission.WRITE_SETTINGS",
  "com.sec.android.provider.badge.permission.READ",
  "com.sec.android.provider.badge.permission.WRITE",
  "com.sonyericsson.home.permission.BROADCAST_BADGE",
  "com.sonymobile.home.permission.PROVIDER_INSERT_BADGE",
  "me.everything.badger.permission.BADGE_COUNT_READ",
  "me.everything.badger.permission.BADGE_COUNT_WRITE",
];

export const blockedPermissions = (adsEnabled: boolean): string[] => (adsEnabled ? [...UNUSED] : [...UNUSED, AD_ID]);

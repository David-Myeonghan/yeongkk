import { describe, expect, it } from "vitest";
import { AD_ID, blockedPermissions, KEPT_PERMISSIONS } from "./androidPermissions";

describe("blockedPermissions", () => {
  it("광고가 없는 빌드는 광고 식별자 권한을 막는다 (tracking-transparency 가 들고 옴)", () => {
    expect(blockedPermissions(false)).toContain(AD_ID);
  });

  it("광고가 있는 빌드는 광고 식별자 권한을 막지 않는다 (광고 SDK 가 쓴다)", () => {
    expect(blockedPermissions(true)).not.toContain(AD_ID);
  });

  it("외부 저장소 · 다른 앱 위에 그리기 · 푸시 · 설치 경로 권한은 광고 여부와 상관없이 막는다", () => {
    for (const ads of [false, true]) {
      expect(blockedPermissions(ads)).toEqual(
        expect.arrayContaining([
          "android.permission.READ_EXTERNAL_STORAGE",
          "android.permission.WRITE_EXTERNAL_STORAGE",
          "android.permission.SYSTEM_ALERT_WINDOW",
          "com.google.android.c2dm.permission.RECEIVE",
          "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
        ]),
      );
    }
  });

  it("앱이 쓰는 권한은 어떤 경우에도 막지 않는다 (알림 · 진동 · 웹뷰)", () => {
    for (const ads of [false, true]) {
      const blocked = blockedPermissions(ads);
      for (const kept of KEPT_PERMISSIONS) expect(blocked).not.toContain(kept);
    }
    expect(KEPT_PERMISSIONS).toEqual(
      expect.arrayContaining([
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.WAKE_LOCK",
        "android.permission.VIBRATE",
      ]),
    );
  });

  it("같은 권한이 두 번 들어가지 않는다", () => {
    const list = blockedPermissions(false);
    expect(new Set(list).size).toBe(list.length);
  });
});

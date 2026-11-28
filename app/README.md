# 앱 껍데기

웹 퀴즈를 웹뷰로 여는 Expo(React Native) 앱이다.
앱이 하는 일은 둘뿐이다. 웹을 열고, 웹이 부르는 기기 기능(공유, 진동, 알림)에 답한다.
메시지 규약은 `../bridge/README.md`에 있다.

## 폰에서 돌려 보기 (Expo Go)

폰이 맥에 닿아야 한다. 맥과 폰을 같은 와이파이에 둔다.

1. 웹 서버를 띄운다. 순서는 루트 `README.md`의 「로컬에서 돌리기」와 같다. 마지막 줄만 바꾼다.

   ```
   cd api
   npx wrangler dev --port 8787 --ip 0.0.0.0
   ```

2. 맥의 LAN 주소를 확인한다. 예: `ipconfig getifaddr en0`
3. 다른 터미널에서 앱을 띄운다.

   ```
   cd app
   EXPO_PUBLIC_WEB_URL=http://<Mac의 LAN 주소>:8787 npx expo start --go
   ```

   `--go`는 Expo Go로 연다. `expo-dev-client`를 깔아 두었기 때문에, 이 옵션이 없으면 개발 빌드를 기다릴 수 있다(`expo start --help`에서 `--go`와 `--dev-client`를 확인했다. 기본값이 바뀌는지는 돌려 보지 않았다).

4. 폰의 Expo Go로 QR 코드를 읽는다.

`EXPO_PUBLIC_WEB_URL`을 비우면 `http://localhost:8787`을 연다. 폰에서는 이 주소가 폰 자신을 가리키므로 열리지 않는다.
주소가 `http://` 또는 `https://`로 시작하지 않으면 앱이 시작할 때 오류를 낸다.

## 광고

광고는 빌드할 때 고르는 선택 사항이다. 기본 상태는 꺼짐이다. `app/package.json`의 `expo.autolinking.exclude`에 `react-native-google-mobile-ads`와 `expo-tracking-transparency` 둘이 들어 있어서, 기본 빌드에는 광고 SDK도 추적 허용(ATT) 라이브러리도 두 OS 모두에 아예 들어가지 않는다. 추적 라이브러리가 빠지므로 iOS 기본 빌드는 AdSupport · AppTrackingTransparency 프레임워크를 링크하지 않고, 추적 문구(`NSUserTrackingUsageDescription`)가 없는 것과 어긋나지 않는다. Expo Go도 그대로 된다.

광고를 넣는 빌드는 스위치 둘을 함께 켠다.

1. `app/package.json`의 `expo.autolinking.exclude`에서 `react-native-google-mobile-ads`와 `expo-tracking-transparency`를 둘 다 뺀다.
2. 아래 AdMob 앱 아이디 환경 변수 둘을 모두 준다.

`app.config.ts`가 둘이 맞는지 설정을 읽을 때 검사하고, 어긋나면 빌드를 멈춘다. 안드로이드 광고 SDK는 앱 아이디가 없으면 시작할 때 죽는다고 구글이 적었다(「Missing application ID.」).

- 제외를 뺐는데 앱 아이디가 없다 -> 오류. 이대로 만들면 앱이 시작하자마자 죽는다.
- 앱 아이디를 줬는데 제외가 남아 있다 -> 오류. 광고를 켠 줄 알겠지만 광고 코드가 빌드에 없다.
- 두 모듈 중 하나만 제외돼 있다 -> 오류(아이디가 있든 없든). 어느 쪽이 빠져 있는지 알려 준다.
- 앱 아이디 하나만 있거나 모양이 틀리다 -> 오류. 조용히 끄지 않는다.
- 둘 다 제외돼 있고 아이디가 없다 -> 광고 꺼짐(기본). 둘 다 빼고 아이디 둘이 있다 -> 광고 켜짐.

- `ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID` 앱 아이디. 있으면 `app.config.ts`가 `react-native-google-mobile-ads`와 `expo-tracking-transparency` 플러그인, iOS 추적 문구(`NSUserTrackingUsageDescription`)를 넣는다.
- `EXPO_PUBLIC_ADMOB_IOS_BANNER_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID` 배너 단위 아이디(`ca-app-pub-숫자16/숫자10`). 개발 빌드에서 비우면 구글 시험용 단위 아이디를 쓴다. 배포 빌드에서 비우면 배너를 띄우지 않는다.

구글 시험용 아이디(주인의 진짜 아이디가 아니다). 출처는 구글 AdMob 빠른 시작과 시험 광고 문서다.

- iOS 앱 `ca-app-pub-3940256099942544~1458002511`, 배너 `ca-app-pub-3940256099942544/2435281174`
- 안드로이드 앱 `ca-app-pub-3940256099942544~3347511713`, 배너 `ca-app-pub-3940256099942544/9214589741`

예(개발 빌드):

```
ADMOB_IOS_APP_ID=ca-app-pub-3940256099942544~1458002511 \
ADMOB_ANDROID_APP_ID=ca-app-pub-3940256099942544~3347511713 \
npx expo prebuild
```

광고 모듈은 네이티브 코드라 Expo Go에서 못 돈다. 광고를 넣은 빌드는 개발 빌드나 배포 빌드여야 한다. Expo Go에서 환경 변수를 줘도 모듈을 불러오지 못해 배너 없이 `{ visible: false }`로 답한다.

동작: 배너는 웹뷰 아래, 안전 영역 안에 놓이고, 숨겨져 있으면 자리를 차지하지 않는다. 웹이 `ads`(`{ visible: true }`)를 부를 때까지 숨겨져 있다. 처음 보일 때 UMP 동의, iOS는 이어서 추적 허용창을 띄운다. 동의 창이 필요 없는 지역(한국 등)에서는 추적창의 답이 곧 결과다. 허용하면 맞춤, 거부하거나 추적창이 실패하면 비맞춤 광고만 요청한다. 유럽처럼 동의 창이 필요한 지역은 거기서 맞춤을 고르지 않아도 비맞춤이다. 동의가 끝나면 광고 SDK를 한 번 초기화한 뒤 배너를 띄운다. 연결이 끊긴 오프라인 화면에서는 배너를 숨기고, 웹뷰가 돌아오면 웹이 요청한 상태대로 다시 보인다. 동의 흐름 자체가 끝나지 않으면 배너를 띄우지 않는다. 앱을 켤 때는 동의와 관련된 어떤 것도 돌지 않는다. 지금 원격 설정은 `ads: false`라 배너는 뜨지 않는다.

스토어 심사 때 볼 것: iOS 개인정보 영양 표시와 추적 문구, 안드로이드 데이터 보안 양식과 `AD_ID` 권한(플러그인이 더한다), 광고 식별자 사용 신고.

## 월요일 알림

웹의 결과 화면에서 「월요일에 알려 줄까요?」를 누르면 `notify`(`schedule-weekly`)가 온다. 앱은 매주 월요일 오전 9시쯤(기기 현지 시각. 안드로이드는 한 시간까지 늦을 수 있다)에 「뭔말이야 / 이번 주 새 말이 올라왔어요.」를 알리는 알림을 하나 건다. 정확한 알람 권한(`SCHEDULE_EXACT_ALARM` · `USE_EXACT_ALARM`)은 일부러 요청하지 않는다. 주간 알림에는 과하고, 안드로이드 14부터 앱 설치 직후에는 기본으로 거부되며, `USE_EXACT_ALARM`은 알람 · 일정 앱용이라 스토어 정책 부담이 있다. 문구와 시각은 `src/notify.ts` 한 곳에 있다. 알림을 누르면 앱만 열린다.

이것은 기기 안에서 예약하는 로컬 알림이다. 서버 푸시가 아니고, 푸시 토큰을 받거나 보내지 않는다. 그래서 `app.config.ts`는 `expo-notifications` 플러그인을 `enableRemoteNotifications: false`로 건다. 이 값이 기본(`true`)이면 플러그인이 iOS 푸시 권한(`aps-environment`)을 더하고, 스토어 설정에 푸시가 들어간다. 안드로이드 쪽은 라이브러리가 `POST_NOTIFICATIONS`(안드로이드 13 이상)와 `RECEIVE_BOOT_COMPLETED`를 매니페스트에 더한다.

앱을 켤 때는 알림과 관련된 어떤 것도 돌지 않는다. 권한 창과 안드로이드 알림 채널은 처음 `request`나 `schedule-weekly`가 올 때 만든다. 네이티브 모듈은 그때 늦게 불러오고, 못 불러오면 `FAILED`로 답한다.

Expo Go: 문서에 따르면 로컬 알림은 Expo Go에서 된다. 원격 푸시는 안드로이드 Expo Go에서 SDK 53부터 안 된다(쓰지 않는다). 이 알림은 안드로이드 에뮬레이터에서 돌려 봤다(권한 창 · 예약 · 시각 · 누르기 · 재부팅). 진짜 폰과 iOS에서는 아직이다.

## 코드 지도

- `src/config.ts` 웹 주소(`WEB_URL`)와 출처(`WEB_ORIGIN`).
- `src/navigation.ts` 어떤 주소를 웹뷰에서 열고, 브라우저로 보내고, 무시할지.
- `src/host.ts` 웹이 부르는 `share`, `haptics`, `notify`, `ads` 처리기. 기기 호출은 밖에서 받는다.
- `src/notify.ts` `notify` 처리기와 알림 문구 · 시각. `src/nativeNotify.ts` 그 기기 호출을 `expo-notifications`에 늦게 불러 잇는다.
- `src/nativeHost.ts` 그 기기 호출을 실제 `Share`, `expo-haptics`에 잇는다.
- `src/reply.ts` 앱의 답을 웹에 주입할 스크립트로 만든다.
- `src/adsConfig.ts` 환경 변수를 광고 설정으로. `src/adsConsent.ts` 동의 순서(한 번만 돎). `src/bannerState.ts` 배너 보임 상태. `src/nativeAds.ts` 광고 모듈을 늦게 불러 호출을 잇는다. `src/AdBanner.tsx` 배너 화면.
- `src/releaseCheck.ts` 스토어 빌드 설정 검사. `scripts/` 아이콘 만들기와 PNG 읽기.
- `src/Shell.tsx` 웹뷰와 위 조각을 묶는다. `src/Offline.tsx`는 연결 실패 화면이다.

순수 모듈(`config`, `navigation`, `host`, `notify`, `reply`, `recovery`, `adsConfig`, `adsConsent`, `releaseCheck`)과 `app.config.ts`, `eas.json` 모양, 아이콘 파일만 루트 `npm test`가 시험한다. 이 시험은 `react-native`를 가져오지 않는다.
`Shell.tsx`, `Offline.tsx`, `nativeHost.ts`, `nativeNotify.ts`, `nativeAds.ts`, `AdBanner.tsx`, `bannerState.ts`는 시험이 없다.

## 빌드 프로필과 출시 설정

`eas.json`에 프로필 셋이 있다. 아직 한 번도 `eas build`를 돌리지 않았다. 순서는 `../docs/release.md`.

- `development` 개발 클라이언트(`expo-dev-client`), 내부 배포. 검사 없음.
- `preview` 내부 배포(출시와 같은 모양). 식별자가 자리표시가 아니어야 하고 웹 주소가 `https://`여야 한다. `workers.dev` 주소는 된다.
- `production` 스토어용(`autoIncrement`, 빌드 번호는 Expo 서버가 올린다: `appVersionSource: remote`).

설정(`app.config.ts`)이 읽는 값은 환경 변수다. 값은 프로필의 `env`(`eas.json`, 비밀이 아니다)에 적는다.

- `APP_IDENTIFIER` iOS 번들 아이디와 안드로이드 패키지 이름. 이 한 곳에서만 정한다. 비우면 자리표시 `app.example.yeongkk`.
- `EXPO_PUBLIC_WEB_URL` 앱이 여는 웹 주소.
- `EAS_PROJECT_ID` `eas init`이 알려 주는 UUID. 있으면 `extra.eas.projectId`로 들어간다. 앱 설정이 코드라서 `eas init`은 파일에 자동으로 못 쓴다.
- `APP_PROFILE` 프로필 이름. `eas.json`이 프로필마다 준다. 클라우드 빌드 서버는 `EAS_BUILD_PROFILE`을 직접 준다. `eas build`가 내 컴퓨터에서 설정을 읽을 때는 프로필 `env`가 합쳐지므로 이 값으로 같은 검사가 돈다. `eas submit`은 프로필 `env`를 읽지 않는다(eas-cli 27.11.0 소스를 읽었고 돌려 보지는 않았다). 제출할 때는 명령 앞에 변수를 직접 붙인다(`../docs/release.md` 8단계 3번). 이 README의 명령 중 `eas`를 돌려 본 것은 하나도 없다.

`src/releaseCheck.ts`가 검사한다. 순수 모듈이고 `app.config.ts`가 부른다. `production`(그리고 `development`, `preview`가 아닌 모든 이름)에서는 아래를 모두 모아 오류 하나로 낸다.

- 식별자가 자리표시이거나 영문 소문자와 숫자 마디 두 개 이상이 아니다.
- 웹 주소가 없다, `https://`가 아니다, `localhost`, IP 주소, 점 없는 이름, `*.workers.dev`다. 설치된 앱 안의 주소는 바꿀 수 없어서, 스토어 빌드는 주인의 도메인만 연다.
- `EAS_PROJECT_ID`가 없다.
- 개인정보 문의처(`../tools/privacy/contact.ts`)가 자리표시 `PRIVACY_CONTACT_PLACEHOLDER` 그대로다.

`development`와 프로필 없음(`expo start`, Expo Go)은 검사하지 않는다. 오류 표는 `../docs/release.md`.

`ios.config.usesNonExemptEncryption: false`로 수출 규정 질문을 바이너리에서 답한다. 이 앱이 쓰는 암호화는 OS의 HTTPS뿐이다. 코드에 직접 만든 암호는 없다(웹의 `crypto.randomUUID`는 무작위 번호 만들기이고, 서버의 SHA-256은 Worker 안에서만 돈다). `ios.supportsTablet`은 `false`다.

아이콘과 스플래시: `assets/icon.png`(1024x1024, 투명 없음), `assets/adaptive-icon.png`, `assets/splash.png`는 자리표시다. 포인트 색 바탕에 「뭔말」을 쓴 그림이고 `npm run assets -w app`(`scripts/generate-assets.ts`, Playwright로 그린다. 글꼴은 이 맥의 시스템 한글 글꼴이라 다른 컴퓨터에서는 모양이 다를 수 있다)으로 다시 만들 수 있다. 주인이 진짜 그림으로 덮어쓴다. 스플래시는 `expo-splash-screen` 플러그인으로 건다(라이트 `#f5f4fa`, 다크 `#15131d`).

## 링크 처리의 한계

웹뷰의 `originWhitelist`는 웹 출처로 제한했다. 허용 출처가 아닌 주소(`mailto:`, `tel:`, `myapp://` 같은 것 포함)는 `react-native-webview`가 먼저 OS로 넘긴다. 이 경우 `src/navigation.ts`의 판정까지 오지 않는다.
허용 검사는 앞 글자만 보므로, 웹 출처로 시작하는 다른 호스트(`https://웹출처.evil.com`)는 통과한다. 이것만 `navigation.ts`가 다시 걸러 기기 브라우저로 보낸다.

## 안드로이드 뒤로 가기

`src/back.ts`(순수 판정)와 `Shell.tsx`의 `BackHandler`가 한다. 판정은 「웹뷰에 기록이 있는가」가 아니라 「지금 문서가 어디인가」를 본다. `onNavigationStateChange`의 `url`을 적어 두고, 지금 문서가 시작 주소(`WEB_URL`)이면 기록이 있어도 시스템 기본(앱을 떠남)이다. 시작 주소가 아닌 페이지(예: `/privacy/`)에서 기록이 있고 오프라인 화면이 아니면 웹뷰 안에서 뒤로 간다. 현재 주소가 http(s)가 아니거나 깨졌으면 시스템 기본이다. 「다시」와 렌더러 복구로 웹뷰를 새로 만들면 `canGoBack`과 적어 둔 주소를 비운다.
시작 주소 비교는 출처(스킴 · 호스트 · 기본 포트 무시)와 경로가 같은지 본다. 경로 끝의 `/`는 무시하고, 쿼리(`/?r=2` 같은 공유 링크)와 해시는 무시한다. 퀴즈가 시작 경로에 있기 때문이다.
이유: 홈 → 개인정보 방침 → 방침의 「← 뭔말이야로 돌아가기」(`href="/"`) → 홈이면 웹뷰 기록이 홈 · 방침 · 홈이 된다. 기록만 보면 홈에서 뒤로 가기가 방침을 다시 띄우고, 문제를 풀다 눌러도 방침으로 간다.
웹은 화면 쌓기(Stackflow)에 history 연동을 쓰지 않아서 홈 · 문제 · 단어 카드 · 결과 화면은 웹뷰 기록을 만들지 않는다. 이 화면들(모두 시작 주소)에서 뒤로 가기는 앱을 떠난다. 웹의 위쪽 「←」 버튼은 화면을 한 칸 뒤로 보내지만 하드웨어 뒤로 가기는 그렇지 않다. 이것이 맞는 동작인지는 웹 쪽에서 정할 일이다(이 앱은 바꾸지 않았다). 개인정보 방침 페이지는 실제 이동이라 기록이 생겨, 뒤로 가기가 홈으로 돌아간다(에뮬레이터 확인, D24 · D47). 링크로 홈에 돌아온 뒤에는 첫 번째 뒤로 가기에서 앱을 떠난다(2026-11-28 에뮬레이터 확인).

## 안드로이드 권한

`app.config.ts`가 `android.blockedPermissions`(`src/androidPermissions.ts`의 `blockedPermissions(광고 여부)`)로 앱이 쓰지 않는 권한을 합친 매니페스트에서 뺀다. 2026-11-27 빌드에서 확인한 출처:

- `com.google.android.gms.permission.AD_ID`: 2026-11-27에는 `expo-tracking-transparency` → `play-services-ads-identifier:18.0.1`이 들고 왔다. 지금은 그 모듈이 기본 빌드에서 제외되므로 이 길로는 오지 않는다. 막는 목록에는 그대로 남겨 두어, 다른 의존이 같은 권한을 끌고 와도 기본 빌드에서 빠지게 한다. 이 변경 뒤의 안드로이드 빌드는 다시 만들어 보지 않았다. 광고 빌드에서는 막지 않는다(광고 플러그인이 더한다).
- `READ_EXTERNAL_STORAGE` · `WRITE_EXTERNAL_STORAGE` · `SYSTEM_ALERT_WINDOW`: `expo prebuild` 템플릿의 앱 매니페스트. `SYSTEM_ALERT_WINDOW`는 릴리스에서 빠지지만 디버그 빌드에는 React Native의 디버그 매니페스트가 다시 넣는다.
- `com.google.android.c2dm.permission.RECEIVE`(와 `WAKE_LOCK` 일부): `expo-notifications` → `firebase-messaging:25.0.1`. `WAKE_LOCK`은 남긴다.
- `BIND_GET_INSTALL_REFERRER_SERVICE`: `expo-notifications`의 의존 `expo-application` → `installreferrer:2.2`.
- 런처 배지 권한 열여섯 개(`READ_APP_BADGE`, 삼성 · HTC · 소니 · 화웨이 · OPPO 등): `expo-notifications` → `ShortcutBadger:1.1.22`.
- 디버그에만 있는 `ACCESS_LOCAL_NETWORK` · `CHANGE_WIFI_MULTICAST_STATE`는 건드리지 않는다.

릴리스 합친 매니페스트 권한: 전 29개 → 후 7개(`INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`, `WAKE_LOCK`, 앱 내부 수신기 권한). 디버그: 31개 → 10개.
푸시: 코드는 푸시 토큰을 요청하지 않는다. `FirebaseMessagingService` · `FirebaseInstanceIdReceiver` · `FirebaseInitProvider`는 라이브러리 때문에 매니페스트에 남지만, 앱을 켜면 「FirebaseApp initialization unsuccessful」(설정 파일 없음)로 시작하지 못한다. 앱을 켰을 때 구글 · 파이어베이스로 가는 네트워크 요청이 있는지는 목적지까지 확인하지 못했다(앱 UID가 와이파이로 보낸 양이 설치 뒤 556바이트 · 4패킷이었고 열린 소켓은 모두 로컬 주소였다. 에뮬레이터 `-tcpdump` 파일이 쓸 만하지 않았다).

## 광고 (안드로이드 확인)

시험용 앱 아이디와 `expo.autolinking.exclude`를 비운 빌드에서 구글 시험 배너가 웹뷰 아래에 떴고, 오프라인 화면에서 사라졌다가 돌아오면 다시 떴고, 동의 창은 뜨지 않았다(한국 같은 곳 기대와 같다). 다만 첫 빌드는 「`RNGoogleMobileAdsModule` could not be found」로 광고가 안 켜졌다. 라이브러리 17.4.0은 안드로이드 모듈을 옛 모듈(`isTurboModule=false`)로 등록하고 React Native 0.88은 `useTurboModuleInterop`을 기본으로 끄므로 이것이 원인이라고 짐작했지만, `reactNativeReleaseLevel`을 `canary` · `stable` · 없음으로 바꿔 새로 빌드해도 모두 뜨고 앱 안에서 읽은 그 플래그도 모두 참이어서 짐작이 틀렸다. 같은 설정의 새 빌드에서 재현하지 못했고 원인은 모른다(처음 빌드의 부분 증분 빌드 상태일 수 있다. 증거 없음). 그래서 빌드 설정은 바꾸지 않았다. 대신 `src/nativeAds.ts`가 광고 라이브러리를 가져오기 전에 네이티브 모듈이 등록돼 있는지 보고(`adsModuleAvailable`), 없으면 그냥 광고를 끈다. 개발 빌드에서 가져오기가 던지면 try/catch로 잡아도 「Uncaught Error」 상자가 뜨기 때문이다.

## 확인하지 못한 것

진짜 폰과 iOS에서는 어떤 빌드도 돌려 본 적이 없다. 안드로이드 에뮬레이터(안드로이드 13)에서는 광고 없는 기본 빌드와 광고 빌드를 디버그로 돌려 봤다(2026-11-27, 결과는 `../docs/device-checklist.md`). 기본 빌드의 릴리스 APK에는 광고 SDK 클래스가 없었다. 광고를 넣은 첫 빌드는 스토어에 내기 전에 반드시 진짜 폰에서 먼저 돌려 본다. iOS의 Gradle 대신 CocoaPods 빌드는 돌리지 않았다.

이 앱은 진짜 폰과 iOS에서 한 번도 돌려 보지 않았다. 이 맥에는 Xcode가 없다(Expo SDK 58은 Xcode 26.4 이상, 그것은 macOS 26.2 이상이 필요한데 이 맥은 14.5).
확인한 것은 타입 검사, 순수 모듈 시험, Metro 번들 만들기(`npx expo export`), `expo-doctor`, 저장소 밖 복사본에서의 `expo prebuild`, 그리고 안드로이드 에뮬레이터에서의 디버그 빌드 실행이다. 아래와 `../docs/device-checklist.md`의 표가 같은 목록이다.
아래는 모두 사람이 폰에서 봐야 한다.

- 웹이 앱 안에서 뜨는지, 첫 화면까지 걸리는 시간.
- `injectedObjectJson()`이 두 OS에서 앱 정보를 주는지. 안 주면 웹이 `hello`로 묻는다.
- 알림: 권한 창이 뜨는지, 월요일 9시쯤에 실제로 오는지(안드로이드는 정확한 시각이 아니라 한 시간까지 늦을 수 있다), 다시 눌러도 하나뿐인지, 끄면 안 오는지, 설정에서 껐을 때 `granted: false`가 오는지, 안드로이드 13 이상에서 권한 창이 채널을 만든 뒤 뜨는지, 알림을 누르면 앱이 열리는지, 없는 예약을 `cancel`해도 오류가 없는지.
- 공유 창, 진동. 안드로이드는 공유 창을 닫아도 `completed: true`가 온다(RN이 닫음을 알려 주지 않는다).
- 광고: 배너가 뜨는지(SDK 초기화 뒤), 동의창과 추적창 순서, 거부 뒤 비맞춤 요청, 숨길 때 자리가 사라지는지, 안전 영역. 이 맥에서는 `expo export`와 `expo prebuild`(복사본)로 설정이 적용되는 것까지만 봤다.
- 노치와 홈 표시줄 아래로 내용이 들어가지 않는지. 앱이 안전 영역 여백을 주므로 웹의 `env(safe-area-inset-*)`는 0이어야 한다.
- 오프라인 화면, 웹뷰 프로세스가 죽은 뒤 다시 불러오기, 앱이 앞으로 돌아올 때의 `resume` 이벤트.
- 외부 링크가 브라우저로 열리는지.

## 일부러 아직 안 한 것

- 알림 누르면 특정 화면 열기(딥링크), 알림 문구 바꾸기, 요일 · 시각 고르기. 서버 푸시.
- OTA 업데이트. (EAS 빌드와 스토어 제출은 설정만 있고 돌려 본 적이 없다.)
- 진짜 아이콘과 스플래시(지금은 자리표시).
- 배포 빌드에서 `http://` 주소 열기. iOS와 안드로이드는 기본으로 평문 http를 막는다. 개발은 Expo Go로만 한다.

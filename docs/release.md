# 출시 순서 (남은 일)

> TL;DR: 코드와 설정은 준비됐다. 남은 것은 전부 주인의 계정이 필요한 일이다. 아래 순서대로 가면 된다. 「사람」은 손으로 하는 일, 「명령」은 터미널에서 돌리는 일이다. 스토어 빌드는 자리표시 값이 남아 있으면 설정을 읽는 단계에서 멈춘다.

상태: 초안(2026-11-25, AI가 씀). David 확인 전.

## 누가 무엇을 확인했나 (먼저 읽는다)

확인한 것(이 맥, 2026-11-25): 단위 테스트, 타입 검사, `expo config` 네 가지 모드, `expo export`(두 OS), `expo prebuild`(저장소 밖 복사본, 두 OS), `expo-doctor`, 웹 빌드, 로컬 Worker(`wrangler dev`)에서 `/privacy/`가 정적 파일로 가고 앱과 `/api/*`가 그대로인 것, Playwright e2e.

아무도 확인하지 않은 것:

- 진짜 폰과 iOS에서 앱을 연 적이 없다. 이 맥에는 Xcode가 없다(Expo SDK 58은 Xcode 26.4 이상, 그것은 macOS 26.2 이상이 필요한데 이 맥은 14.5). 안드로이드 에뮬레이터(안드로이드 13)에서는 디버그 빌드로 돌려 봤고(2026-11-27), `docs/device-checklist.md`의 안드로이드 칸이 그 결과다. iOS 칸은 비어 있다.
- `eas build`, `eas submit`을 돌린 적이 없다. Expo 계정, Apple Developer 계정, Google Play 계정으로 로그인한 적이 없다. 안드로이드는 이 맥에서 Gradle로 디버그와 릴리스(디버그 키 서명) 빌드를 했다(2026-11-27). EAS 클라우드 빌드, 스토어 서명 빌드, iOS(CocoaPods · Xcode)는 돌려 본 적이 없다.
- 웹 배포는 한 번도 성공하지 못했다(`docs/adr/0004-one-worker-hosting.md`). `STATS_TOKEN`은 만들지 않았다. D1은 만들지 않았다.
- 스토어 양식(`docs/store/`)은 코드에서 뽑은 초안이고 어느 스토어 화면에도 넣어 본 적이 없다.
- 게시된 단어가 0개다.
- 아이콘과 스플래시는 자리표시다(`app/scripts/generate-assets.ts`가 글자 「뭔말」을 그린 것).

이 문서의 명령은 하나도 돌려 보지 않았다(`gh`, `eas`, `wrangler` 모두). `expo config`, `expo prebuild`, `expo export`, 테스트만 이 맥에서 돌렸다.

명령이 보는 환경(eas-cli 27.11.0 소스를 읽은 것이고 돌려 보지는 않았다): `eas build`는 프로필의 `env`를 설정 읽기에 합치고 빌드 서버에도 준다. `eas submit`은 프로필의 `env` 없이 `app.config.ts`를 읽는다. `eas device:create`도 프로필의 `env` 없이 설정을 읽는다. 그래서 `eas submit`과 `eas device:create` 앞에는 필요한 변수를 직접 붙인다(6단계 1번, 8단계 3번, 9단계 2번). `eas init`, `expo config`, `expo prebuild`도 프로필 `env`를 읽는다고 보지 않는다. `eas init`은 프로젝트 아이디를 만드는 명령이라 그 값이 없어도 된다. 나머지는 변수를 앞에 붙여 적었다.

읽은 공식 문서(2026-11-25, 내용은 바뀔 수 있다):

- EAS 설정 파일: https://docs.expo.dev/eas/json/ · 앱 버전: https://docs.expo.dev/build-reference/app-versions/ · 환경 변수: https://docs.expo.dev/eas/environment-variables/usage/
- 내부 배포: https://docs.expo.dev/build/internal-distribution/ · iOS 제출: https://docs.expo.dev/submit/ios/ · 안드로이드 제출: https://docs.expo.dev/submit/android/
- Play 신규 개인 계정 비공개 테스트: https://support.google.com/googleplay/android-developer/answer/14151465

## 1. 앱 식별자와 도메인을 정한다

- 「사람」 식별자를 정한다. 영문 소문자와 숫자로 된 마디를 점으로 이은 두 마디 이상(예: `kr.mynmal.app`). 두 스토어에 올린 뒤에는 바꿀 수 없다. 스토어 빌드가 이 값을 검사한다.
- 「사람」 도메인을 산다. 스토어 빌드는 `*.workers.dev`, `localhost`, IP 주소를 열지 않는다. 설치된 앱 안의 주소는 바꿀 수 없기 때문이다. 한글 도메인이면 punycode(`xn--…`)로 적는다. 앱이 주소를 읽는 함수(`originOf`)는 영문 소문자 · 숫자 · `-` · `.`만 받고, `뭔말이야.kr`이나 `my_quiz.example.com`은 읽지 못해 앱이 켜지자마자 죽기 때문이다(`xn--bj0bj22bn7n.kr` 모양은 읽는 것을 확인했다). 스토어 빌드 검사도 같은 함수로 막는다.
- 「사람」 앱 이름 상표(KIPRIS)를 확인한다(`docs/decisions.md`의 「아직 안 정한 것」).

성공하면: 식별자 한 줄과 도메인 한 줄이 정해진다.

## 2. 웹을 배포한다

순서는 `.github/workflows/deploy.yml`이 정한다: D1 확인 → `npm ci` → 문의처 확인 → `npm run check` → 빌드 → D1 마이그레이션 → 올리기. 웹과 앱은 따로 배포된다. 방침 페이지는 웹에 들어 있으므로 문의처를 먼저 채운다. 문의처가 자리표시이면 배포가 `::error::`로 멈춘다.

1. 「사람」 `tools/privacy/contact.ts`의 `PRIVACY_CONTACT`를 실제 문의처로 바꾼다(이메일이나 문의 페이지 주소). 이 저장소는 공개라서 문의 전용 주소를 쓰는 것이 좋다. 개인 이메일이나 전화번호를 넣지 않는다.
   ```
   npm run privacy
   npm test
   ```
   성공하면: `docs/privacy.md`와 `web/public/privacy/index.html`이 바뀌고 `npm test`가 통과한다(테스트는 문의처가 자리표시인지 아닌지에 기대지 않는다). 둘이 어긋나면 `tools/privacy/privacy.test.ts`가 실패한다. 이 변경을 PR로 합친다.
2. 「사람」 Cloudflare 계정 이름을 확인한다. 첫 배포 전에, 계정 이름이나 `workers.dev` 하위 도메인에 실제 이름이나 이메일이 들어 있지 않은지 대시보드에서 본다. 들어 있으면 `workers.dev` 주소를 앱에 쓰지 않고, 이름을 바꾸거나 커스텀 도메인만 쓴다.
3. 「사람」 저장소 비밀값을 확인한다: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`(배포와 D1 만들기가 쓴다).
   ```
   gh secret list
   ```
   성공하면: 두 이름이 목록에 있다.
4. 「명령」 통계 비밀값 `STATS_TOKEN`을 만든다. 긴 무작위 값이어야 한다.
   ```
   openssl rand -base64 32 | gh secret set STATS_TOKEN
   ```
   성공하면: `gh secret list`에 `STATS_TOKEN`이 보인다. 값은 화면에 나오지 않는다. 안 만들면 `/api/stats`는 401이다.
5. 「명령」 D1을 만든다(한 번만).
   ```
   gh workflow run d1-create
   gh run watch
   ```
   성공하면: 로그에 데이터베이스 UUID가 나온다. 이미 있으면 실패한다(정상).
6. 「사람」 그 UUID를 `api/wrangler.jsonc`의 `database_id`에 넣고 PR로 합친다(자리표시 `00000000-0000-0000-0000-000000000000` 대신).
   성공하면: `deploy`가 합친 직후 자동으로 돌고 끝까지 초록이다(`api/**`가 바뀌면 돈다).
7. 「명령」 배포가 됐는지 본다.
   ```
   curl -s https://<워커 주소>/api/health
   curl -sI https://<워커 주소>/privacy/ | head -1
   ```
   성공하면: 첫 줄이 `ok`, 둘째가 `HTTP/2 200`이다.
8. 「사람」 도메인을 Worker에 붙인다. Cloudflare 대시보드의 Workers > `yeongkk` > 설정 > 도메인 및 경로 > 커스텀 도메인(메뉴 이름은 바뀔 수 있다). 도메인의 DNS가 Cloudflare에 있어야 한다.
   성공하면: `https://<도메인>/` 이 퀴즈를 열고 `https://<도메인>/privacy/` 가 방침을 연다.

## 3. 단어를 채운다

게시된 단어가 0개이면 앱은 「아직 단어가 없어요」만 보여 준다. 이 상태로 심사에 내면 지침 4.2로 거절될 가능성이 매우 높다(`docs/store/review-notes.md`).

- 「사람」 단어를 PR로 올린다. 한 판은 10문제라 최소 10개가 필요하다. 계획이 말하는 숫자는 100개다(`docs/decisions.md`). 단어마다 서로 다른 플랫폼(YouTube, Instagram, TikTok) 출처 주소 둘이 있어야 한다(`docs/word-criteria.md`).
  ```
  npm run add-word
  npm run check
  ```
  성공하면: `npm run check`가 오류 없이 끝나고, PR을 합치면 배포가 돌아 `https://<도메인>/words.ko-KR.json`에 단어가 보인다.

## 4. 아이콘을 바꾼다

1. 「사람」 아이콘을 바꾼다. `app/assets/icon.png`(1024x1024, 투명 없음), `app/assets/adaptive-icon.png`(투명 배경 앞 그림, 가운데 66% 안에 그림), `app/assets/splash.png`를 새 그림으로 덮어쓴다. 지금 파일은 자리표시다. `npm run assets -w app`은 자리표시를 다시 그릴 뿐이니 바꾼 파일 위에서는 돌리지 않는다.
   성공하면: `npm test`의 `app/scripts/assets.test.ts`가 통과한다(크기와 투명도 검사).

## 5. Expo를 준비한다

1. 「사람」 Expo 계정을 만든다.
2. 「명령」
   ```
   cd app
   npx eas-cli login
   npx eas-cli init
   ```
   `eas init`은 프로젝트를 만들고 아이디를 알려 준다. 이 앱의 설정은 코드(`app.config.ts`)라서 파일에 자동으로 못 쓴다(`expo install`에서 같은 안내가 나왔다: 「Cannot automatically write to dynamic config」). 아이디만 받아 적는다.
   성공하면: 프로젝트 UUID가 나온다.
3. 「사람」 `app/eas.json`의 `preview`와 `production` 프로필 `env`에 값을 적는다. 이 값들은 비밀이 아니다(앱 안에 들어간다). 커밋한다.
   ```json
   "production": {
     "distribution": "store",
     "autoIncrement": true,
     "env": {
       "APP_PROFILE": "production",
       "APP_IDENTIFIER": "<1단계에서 정한 식별자>",
       "EXPO_PUBLIC_WEB_URL": "https://<도메인>",
       "EAS_PROJECT_ID": "<eas init 이 알려 준 UUID>"
     }
   }
   ```
   `preview`도 같은 식별자, `EAS_PROJECT_ID`를 넣고, `EXPO_PUBLIC_WEB_URL`은 도메인을 붙이기 전이면 워커 주소(https)를 써도 된다. `APP_PROFILE`은 지우지 않는다. 지우면 `eas build`가 내 컴퓨터에서 설정을 읽을 때 검사가 안 돈다. (`EAS_BUILD_PROFILE`은 클라우드 빌드 서버에서만 생긴다. `eas build`가 내 컴퓨터에서 설정을 읽을 때는 프로필의 `env`가 합쳐진다. `eas submit`은 합치지 않는다. 출처: Expo 환경 변수 문서가 「빌트인 변수는 app.config.js를 로컬에서 평가할 때 없다」고 적는다. eas-cli 27.11.0 소스에서 `eas build`의 합치기와 `eas submit`의 합치지 않음을 읽었다. 돌려 보지는 않았다.)
4. 「명령」 내 컴퓨터에서 먼저 검사한다.
   ```
   cd app
   EAS_BUILD_PROFILE=production APP_IDENTIFIER=<식별자> EXPO_PUBLIC_WEB_URL=https://<도메인> EAS_PROJECT_ID=<UUID> npx expo config --type public
   ```
   성공하면: 설정이 출력된다. 실패하면 아래 「멈췄을 때」 표를 본다.
5. 「사람」 Apple Developer 계정(유료)과 Google Play Console 계정이 필요하다. 첫 `eas build`가 인증서를 만들어 주겠다고 물을 때 Apple 계정으로 로그인한다.

## 6. preview 빌드 → 실기기 점검

1. 「명령」
   ```
   cd app
   EAS_PROJECT_ID=<UUID> npx eas-cli device:create        # iPhone 등록(iOS 내부 배포는 기기를 등록해야 한다). 프로필의 env를 읽지 않아 아이디를 직접 붙인다
   npx eas-cli build --profile preview --platform all
   ```
   Expo 문서: iOS 내부 배포는 유료 Apple 계정과 기기 등록이 필요하고, 새 계정은 등록한 기기가 설치 가능해지기까지 24~72시간이 걸릴 수 있다. 안드로이드는 APK다.
   성공하면: 두 빌드가 끝나고 설치 주소와 QR이 나온다.
2. 「사람」 실제 iPhone 한 대와 안드로이드 폰 한 대에 설치한다.
3. 「사람」 `docs/device-checklist.md`의 표를 위에서 아래로 채운다. 광고 줄(D26~D31)은 7단계 빌드에서 한다.
   성공하면: 광고 줄을 뺀 모든 줄에 결과가 적혀 있고, 「실패」가 없다.
   안드로이드 칸은 에뮬레이터에서 한 번 채웠다(2026-11-27). 진짜 폰에서 다시 확인해야 하는 줄(진동 D13, 망 변화 D14, 알림이 실제로 몇 시에 오는지 D34, 제조사 알림 정책)과 iOS 칸 전부가 남았다. 알림은 「월요일 오전 9시쯤, 안드로이드는 한 시간까지 늦을 수 있다」로 적는다. 정확한 알람 권한(`SCHEDULE_EXACT_ALARM` · `USE_EXACT_ALARM`)은 일부러 쓰지 않는다.

## 7. (선택) 광고 빌드

광고는 기본이 꺼짐이다. 켜려면 `app/README.md`의 두 스위치를 함께 켠다: `expo.autolinking.exclude`에서 `react-native-google-mobile-ads`와 `expo-tracking-transparency` 둘을 다 빼고, AdMob 앱 아이디 둘(`ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID`)을 해당 프로필의 `env`에 적는다(`eas build`가 읽는다. 배너 아이디 `EXPO_PUBLIC_ADMOB_*`도 같다). 어긋나면 설정을 읽을 때 멈춘다. `eas submit`도 같은 설정을 읽으므로, 광고 빌드를 제출할 때는 아래 3번 명령 앞에 `ADMOB_*` 둘도 붙인다.
안드로이드 에뮬레이터에서는 시험용 아이디의 디버그 빌드에서 구글 시험 배너가 떴다(D29). 다만 첫 빌드는 「RNGoogleMobileAdsModule could not be found」로 광고가 안 켜졌고(앱은 오류 없이 광고만 끈다), 같은 설정으로 새로 만든 빌드에서는 재현하지 못했다. 원인은 모른다. 광고 빌드를 만들면 배너가 실제로 뜨는지 먼저 본다(`docs/device-checklist.md` D29 · D31). 안 뜨는데 원격 설정 `ads`만 켜 두면 광고 없이 돈다.
iOS 광고 빌드의 `Info.plist`에는 `SKAdNetworkItems`로 구글의 식별자 `cstr6suwn9.skadnetwork` 하나만 들어간다(`app/app.config.ts`, 광고 플러그인의 `skAdNetworkItems` 옵션). 구글은 광고 구매자 식별자를 더 긴 목록으로 공개하므로, 진짜 광고를 내보내기 전에 그 목록을 같은 옵션에 붙여 넣는다. 지금 값만으로는 일부 구매자가 빠질 수 있다.

순서(제안): 시험용 아이디로 `preview` 빌드 → 실기기에서 D26~D31 → 진짜 아이디로 바꿈 → 원격 설정 `features.ads`를 켜는 PR → `docs/store/app-privacy.md`의 B 표로 양식을 낸다.

## 8. production 빌드와 App Store

1. 「사람」 App Store Connect에서 앱을 만든다(식별자는 1단계 값). 앱 아이디(`ascAppId`)를 적어 둔다.
2. 「사람」 `app/eas.json`의 `submit.production`에 `{ "ios": { "ascAppId": "<번호>" } }`를 적는다.
3. 「명령」
   ```
   cd app
   npx eas-cli build --profile production --platform ios
   APP_PROFILE=production APP_IDENTIFIER=<식별자> EXPO_PUBLIC_WEB_URL=https://<도메인> EAS_PROJECT_ID=<UUID> \
     npx eas-cli submit --platform ios --profile production
   ```
   `eas submit`은 프로필의 `env`를 읽지 않아서 변수를 앞에 직접 붙인다. 안 붙이면 식별자가 자리표시로, 프로젝트 아이디가 없는 것으로 읽힌다.
   성공하면: 처리 10~15분 뒤 TestFlight에 빌드가 보인다(Expo 문서).
4. 「사람」 App Store Connect에 넣는다: `docs/store/listing.ko.md`(이름, 부제, 설명, 키워드, 지원 URL, 처리방침 URL), `docs/store/app-privacy.md`(개인정보 답), `docs/store/age-rating.md`(연령 등급), `docs/store/review-notes.md`(심사 메모와 연락처), 스크린샷(iPhone, 1179x2556 또는 1206x2622, 1~10장).
5. 「사람」 TestFlight로 본인 폰에서 한 번 더 돌려 본다.
6. 「사람」 심사에 제출한다. 거절되면 사유 원문을 `docs/decisions.md`에 적는다.
   - 제출 전에 알아 둘 것: Apple 지침 5.1.1(i)은 앱 안에서도 처리방침 링크를 요구한다. 앱 안에서는 홈 → 「개인정보 처리방침」으로 닿고, 방침 페이지의 「← 뭔말이야로 돌아가기」로 홈에 돌아온다. 실기기에서 확인한다(`docs/device-checklist.md` D47).

## 9. Google Play

1. 「사람」 Play Console에서 앱을 만들고, 서비스 계정 키를 Expo에 올린다(Expo 문서: `eas submit`에 필요).
2. 「명령」
   ```
   cd app
   npx eas-cli build --profile production --platform android
   APP_PROFILE=production APP_IDENTIFIER=<식별자> EXPO_PUBLIC_WEB_URL=https://<도메인> EAS_PROJECT_ID=<UUID> \
     npx eas-cli submit --platform android --profile production
   ```
   (`eas submit`은 프로필의 `env`를 읽지 않는다. 위와 같다.)
   성공하면: 첫 출시가 내부 테스트 트랙에 만들어진다(Expo 문서).
3. 「사람」 데이터 보안 양식(`docs/store/app-privacy.md`), 콘텐츠 등급, 대상 연령(16세 이상), 처리방침 URL을 Play Console에 넣는다.
4. 「사람」 개인 계정을 2023-11-13 이후에 만들었다면 production 전에 비공개 테스트를 한다. 테스터 12명 이상이 14일 연속 참여해야 한다(Google 도움말). 12명을 모으고 14일을 센다.
   성공하면: 14일 뒤 Play Console이 production 신청을 열어 준다. 계정을 그 전에 만들었다면 이 요구가 없을 수 있다. Console 화면의 안내를 따른다.

## 멈췄을 때 (설정을 읽을 때 나오는 오류)

`production`(또는 이름이 `development`, `preview`가 아닌 모든 프로필)은 아래를 모두 모아 한 번에 알려 준다. `preview`는 식별자가 자리표시인지와 주소가 https인지만 본다. `development`와 프로필 없음은 검사하지 않는다.

| 오류가 말하는 것 | 왜 막나 | 고치는 법 |
| --- | --- | --- |
| `APP_IDENTIFIER 가 자리표시 값 … 그대로예요` | 두 스토어 모두 식별자는 올린 뒤 못 바꾼다 | `eas.json`의 해당 프로필 `env`에 `APP_IDENTIFIER`를 적는다 |
| `APP_IDENTIFIER 모양이 틀려요` | 대문자 · `_` · `-` · 한 마디짜리 · 숫자로 시작하는 마디는 두 OS에서 문제가 된다 | 소문자와 숫자 마디를 점으로 이은 두 마디 이상으로 바꾼다 |
| `EXPO_PUBLIC_WEB_URL 가 비어 있어요` | 값이 없으면 앱이 `http://localhost:8787`을 연다 | 도메인 주소를 `env`에 적는다 |
| `EXPO_PUBLIC_WEB_URL 는 https:// 로 시작하고 앱이 읽을 수 있는 주소여야 해요` | 평문 http는 OS가 막고, 한글 도메인 · `_`는 앱이 못 읽어 켜자마자 죽는다 | `https://`로 시작하는 영문 소문자 · 숫자 · `-` · `.` 주소로. 한글 도메인은 `xn--` |
| `… 주인의 도메인이 아니에요(localhost / IP / workers.dev / 도메인이 아니에요)` | 설치된 앱 안의 주소는 바꿀 수 없다. 내 도메인이어야 서버를 옮길 수 있다 | 2단계 8번에서 붙인 도메인을 쓴다(`preview`는 workers.dev 허용) |
| `EAS_PROJECT_ID 가 없어요` | EAS가 이 빌드를 어느 프로젝트에 넣을지 모른다 | 5단계 2번의 UUID를 `env`에 적는다 |
| `개인정보 문의처가 자리표시 … 그대로예요` | 방침에 문의처가 없으면 스토어가 거절한다 | 2단계 1번 |
| 위가 아닌 광고 관련 오류(`AdMob …`, `autolinking.exclude …`) | `app/README.md`의 광고 스위치가 어긋났다 | `app/README.md`의 「광고」 |
| 내 컴퓨터에서는 통과하는데 클라우드 빌드만 실패 | 클라우드는 `EAS_BUILD_PROFILE`을 직접 준다. `env`의 값이 그 프로필에 없을 수 있다 | `eas.json`의 해당 프로필 `env`를 확인한다 |
| `eas submit`이나 `eas device:create`가 프로젝트 아이디가 없다거나 식별자가 `app.example.yeongkk`라고 함 | 두 명령은 프로필의 `env`를 읽지 않는다 | 명령 앞에 `EAS_PROJECT_ID=…`(제출은 `APP_IDENTIFIER=…`도)를 붙인다(6단계 1번, 8단계 3번) |
| 웹 배포(`deploy`)가 `개인정보 문의처가 자리표시 … 그대로예요`로 멈춤 | 공개 방침 페이지에 자리표시가 보이는 것을 막는다 | 2단계 1번: `tools/privacy/contact.ts`를 고치고 `npm run privacy`, 합친다 |

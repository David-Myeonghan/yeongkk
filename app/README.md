# 앱 껍데기

웹 퀴즈를 웹뷰로 여는 Expo(React Native) 앱이다.
앱이 하는 일은 둘뿐이다. 웹을 열고, 웹이 부르는 기기 기능(공유, 진동)에 답한다.
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
   EXPO_PUBLIC_WEB_URL=http://<Mac의 LAN 주소>:8787 npx expo start
   ```

4. 폰의 Expo Go로 QR 코드를 읽는다.

`EXPO_PUBLIC_WEB_URL`을 비우면 `http://localhost:8787`을 연다. 폰에서는 이 주소가 폰 자신을 가리키므로 열리지 않는다.
주소가 `http://` 또는 `https://`로 시작하지 않으면 앱이 시작할 때 오류를 낸다.

## 코드 지도

- `src/config.ts` 웹 주소(`WEB_URL`)와 출처(`WEB_ORIGIN`).
- `src/navigation.ts` 어떤 주소를 웹뷰에서 열고, 브라우저로 보내고, 무시할지.
- `src/host.ts` 웹이 부르는 `share`, `haptics` 처리기. 기기 호출은 밖에서 받는다.
- `src/nativeHost.ts` 그 기기 호출을 실제 `Share`, `expo-haptics`에 잇는다.
- `src/reply.ts` 앱의 답을 웹에 주입할 스크립트로 만든다.
- `src/Shell.tsx` 웹뷰와 위 조각을 묶는다. `src/Offline.tsx`는 연결 실패 화면이다.

순수 모듈(`config`, `navigation`, `host`, `reply`)만 루트 `npm test`가 시험한다. 이 시험은 `react-native`를 가져오지 않는다.
`Shell.tsx`, `Offline.tsx`, `nativeHost.ts`는 시험이 없다.

앱 식별자(`app.config.ts`의 `APP_IDENTIFIER`)는 자리표시 값 `app.example.yeongkk`다. 주인이 정하기 전에는 스토어용 빌드를 만들지 않는다.

## 링크 처리의 한계

웹뷰의 `originWhitelist`는 웹 출처로 제한했다. 허용 출처가 아닌 주소(`mailto:`, `tel:`, `myapp://` 같은 것 포함)는 `react-native-webview`가 먼저 OS로 넘긴다. 이 경우 `src/navigation.ts`의 판정까지 오지 않는다.
허용 검사는 앞 글자만 보므로, 웹 출처로 시작하는 다른 호스트(`https://웹출처.evil.com`)는 통과한다. 이것만 `navigation.ts`가 다시 걸러 기기 브라우저로 보낸다.

## 확인하지 못한 것

이 앱은 실제 폰이나 시뮬레이터에서 한 번도 돌려 보지 않았다. 이 맥에는 Xcode가 없다.
확인한 것은 타입 검사, 순수 모듈 시험, Metro 번들 만들기(`npx expo export`), `expo-doctor`뿐이다.
아래는 모두 사람이 폰에서 봐야 한다.

- 웹이 앱 안에서 뜨는지, 첫 화면까지 걸리는 시간.
- `injectedObjectJson()`이 두 OS에서 앱 정보를 주는지. 안 주면 웹이 `hello`로 묻는다.
- 공유 창, 진동. 안드로이드는 공유 창을 닫아도 `completed: true`가 온다(RN이 닫음을 알려 주지 않는다).
- 노치와 홈 표시줄 아래로 내용이 들어가지 않는지. 앱이 안전 영역 여백을 주므로 웹의 `env(safe-area-inset-*)`는 0이어야 한다.
- 오프라인 화면, 웹뷰 프로세스가 죽은 뒤 다시 불러오기, 앱이 앞으로 돌아올 때의 `resume` 이벤트.
- 외부 링크가 브라우저로 열리는지.

## 일부러 아직 안 한 것

- 광고, 알림(`notify`, `ads`).
- EAS 빌드, 스토어 제출, OTA 업데이트.
- 안드로이드 뒤로 가기 버튼 처리.
- 아이콘과 스플래시.
- 배포 빌드에서 `http://` 주소 열기. iOS와 안드로이드는 기본으로 평문 http를 막는다. 개발은 Expo Go로만 한다.

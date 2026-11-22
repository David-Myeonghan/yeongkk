# 웹뷰 브릿지 규약

웹 퀴즈와 앱 껍데기(Expo)가 주고받는 메시지 규약이다. 깔려 있는 옛 앱과 새 웹이 늘 섞인다는 전제로 만들었다.
`bridge/`는 순수 TypeScript다. React도, Node 전용 모듈도 쓰지 않는다. 브라우저 것은 전부 인자로 받는다.
`Window`의 모양을 아는 파일은 `attach.ts` 하나뿐이다.

## 규칙 여섯

1. 기능은 묻고 쓴다. 웹은 `has(이름, 최소 버전)`으로 확인한 기능만 부른다. 없는 기능은 보내지도 않는다.
2. 인사는 두 길이다. 빠른 길은 앱이 자기 정보를 미리 넣어 두는 것이다. 느린 길은 그게 없을 때 웹이 `hello` 요청을 보내고 정해진 시간(기본 300ms)만 기다리는 것이다. 답이 없으면 브라우저로 본다.
3. 더하기만 한다. 새 기능과 새 필드는 추가만 한다. 받는 쪽은 모르는 필드, 모르는 이벤트, 모르는 종류의 메시지를 버리고 죽지 않는다.
4. 기능마다 버전이 있다. 기능표는 `이름 → 정수 버전`이다. 기능의 뜻이 바뀌면 그 기능 버전만 올린다. 규약 전체 버전(`PROTOCOL_VERSION`)은 메시지 모양이 깨질 때만 올린다.
5. 모든 요청에는 시간 제한이 있다(기본 5000ms). 답이 안 오면 `TIMEOUT`으로 끝내고 웹 방식으로 넘어간다. 늦게 온 답은 버린다.
6. 모르는 요청에는 반드시 거절로 답한다. 앱은 모르는 이름에 `UNSUPPORTED`를 돌려준다. 조용히 무시하지 않는다.

모르는 규약 버전(앱이 2, 웹은 1만 앎)을 만나면 웹은 앱이 없는 것으로 보고 전부 웹 방식으로 간다.

## 메시지 모양

```
요청   { v, kind: "request",  id, name, payload? }
응답   { v, kind: "response", id, ok: true,  result? }
       { v, kind: "response", id, ok: false, error: { code, message? } }
이벤트 { v, kind: "event", name, payload? }
```

오류 코드는 `UNSUPPORTED`, `TIMEOUT`, `FAILED`, `BAD_REQUEST`, `NO_HOST` 다.

자기 소개(`HostInfo`)는 `{ protocol, appVersion, platform, capabilities }` 모양이다. `capabilities`는 기능 이름과 정수 버전의 표다.
`hello` 요청의 결과도 같은 모양이다.

## 길 — 메시지가 오가는 곳

웹에서 앱으로는 `window.ReactNativeWebView.postMessage(문자열)`이다. `react-native-webview` 안내서(Guide.md)에 따르면 앱 쪽이 `onMessage`를 설정하지 않으면 이 함수는 웹 페이지에 주입되지 않는다. 또 인자는 하나뿐이고 문자열이어야 한다.
그래서 메시지는 `JSON.stringify` 한 문자열로 보낸다.

앱에서 웹으로는 안내서가 말하는 「React Native -> Web: `injectJavaScript` 메서드」로, `webViewRef.injectJavaScript(...)`가 `window.__YK_BRIDGE__.receive(메시지)`를 부른다.
`attachToWindow`가 이 자리를 걸어 준다.

자기 소개를 미리 넣는 길(빠른 길)은 `injectedJavaScriptObject`다. 앱이 이 값을 넣으면 웹은 `window.ReactNativeWebView.injectedObjectJson()`으로 읽는다.
안내서에 따르면 이 함수는 `injectedJavaScriptObject`로 넘긴 객체를 JSON 문자열로 돌려주고, 속성을 읽으려면 `JSON.parse`를 거쳐야 하며, 값이 `undefined`일 수도 있다.
`injectedJavaScriptBeforeContentLoaded`는 Reference.md에서 「On Android, this may work, but it is not 100% reliable」라고 하고 「Consider `injectedJavaScriptObject` instead.」라고 권한다. 안내서도 안드로이드의 경쟁 상태 때문에 「this more reliable prop was added」라고 적는다. 그래서 이 길을 쓴다.
출처는 github.com/react-native-webview/react-native-webview 의 `master` 브랜치 `docs/Reference.md`와 `docs/Guide.md`다. 2026-11-22에 확인했다.

핵심(`createWebBridge`)은 이 길을 모른다. 핵심은 `env.post`(보내는 함수)와 `env.injected`(미리 받은 자기 소개)만 받는다.
창에 붙이는 일은 `attachToWindow(win)`이 한다. 이 함수는 `injectedObjectJson()`의 글자를 `JSON.parse`해서, 결과가 평범한 객체일 때만 `env.injected`로 넘긴다.
함수가 없거나, 던지거나, 빈 글자거나, JSON이 아니거나, 객체가 아니면(`null`, 숫자, 배열 등) `injected`를 비워서 웹이 `hello`로 묻게 한다.
객체인데 `parseHostInfo`를 통과하지 못하면(예: 규약 2) 앱 없음으로 끝내고 `hello`는 보내지 않는다.

## 기능표

| 기능 | 버전 | payload → 결과 |
| --- | --- | --- |
| `share` | 1 | `{ title?, text?, url? }` → `{ completed: boolean }` |
| `haptics` | 1 | `{ kind }` |
| `notify` | 1 | `{ action: "status" \| "request" \| "schedule-weekly" \| "cancel" }` → `{ granted: boolean }` |
| `ads` | 1 | `{ visible: boolean }` |
| `offline` | - | 자리만, 아직 정의 안 함 |

지금 앱 쪽 처리기가 실제로 있는 것은 아직 없다. 위 표는 규약상의 약속이다.

공유는 `share(bridge, data, env)`가 앱, 웹 공유, 복사 순으로 대신한다.
앱 공유 호출은 공유 창이 열려 있는 동안을 기다리느라 60초까지 기다린다. 이때 `TIMEOUT`이면 창이 이미 떠 있을 가능성이 크므로 두 번째 창을 열거나 몰래 복사하지 않고 `{ via: "native", completed: false }`로 끝낸다. 그 밖의 앱 호출 실패(`UNSUPPORTED`, `FAILED`, `NO_HOST`, `BAD_REQUEST`, `BridgeError`가 아닌 오류)는 다음으로 넘어간다. 사용자가 웹 공유 창을 닫으면(`AbortError`) 거기서 끝내고 복사로 넘어가지 않는다.

## 새 기능을 더하는 절차

1. 이 표에 이름, 버전 1, payload와 결과를 먼저 적는다.
2. 앱 쪽: `createNativeHost`의 `handlers`에 `{ version: 1, handle }`을 더한다.
3. 웹 쪽: `bridge.has(이름)`이 참일 때만 `bridge.call(이름, payload)`을 부르고, 실패하면 웹 방식으로 대신하는 길을 둔다.
4. `matrix.test.ts`에 그 기능이 없는 옛 껍데기 줄과 있는 껍데기 줄을 더한다.
5. 기존 기능의 뜻이 바뀌면 그 기능 버전만 올리고, 옛 버전 줄을 표 테스트에 남긴다.

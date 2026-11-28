# 뭔말이야

요즘 10~20대 신조어를 퀴즈로 맞히는 앱이다. 저장소와 코드 이름은 `yeongkk`로 그대로 둔다.
웹 퀴즈가 먼저고, Worker 하나가 웹 파일과 API를 같이 내준다. 앱 껍데기(`app/`, Expo)가 그 웹을 웹뷰로 연다. 빌드 프로필 · 자리표시 설정 검사 · 개인정보 처리방침 · 스토어 등록 초안은 준비돼 있다. 안드로이드는 에뮬레이터에서 디버그 빌드로 한 번 돌려 봤다(2026-11-27, `docs/device-checklist.md`). 진짜 폰, iOS, 릴리스 · EAS 빌드는 아직이다.

## 아직 없는 것

- 배포된 곳이 없다. 배포 워크플로는 있지만 아직 한 번도 성공하지 못했다.
- 게시된 단어가 0개다(`words/ko-KR/`는 비어 있다).
- 자동 수집은 없다. 광고(기본 꺼짐)와 월요일 알림은 안드로이드 에뮬레이터에서만 돌려 봤다. iOS와 진짜 폰에서는 아직이다.
- 스토어 빌드와 제출은 한 번도 하지 않았다. 앱 식별자 · 도메인 · 개인정보 문의처 · Expo 프로젝트는 아직 정하지 않았고, 아이콘과 스플래시는 자리표시다. 남은 순서는 `docs/release.md`.

## 폴더

- `words/` 게시 단어. PR로만 추가한다.
- `config/` 금칙어(`ko-KR/banned.txt`)와 원격 설정(`remote/ko-KR.json`).
- `schema/` 단어와 설정의 JSON 스키마.
- `registry/` 단어 등록 검사 · 묶기 · `add-word`(TypeScript).
- `quiz-core/` 한 판 구성 · 문제 · 채점 · 실험 배정. 화면 없는 순수 로직.
- `bridge/` 웹과 앱이 주고받는 메시지 규약. 자세한 것은 `bridge/README.md`.
- `web/` 퀴즈 웹(React + Vite).
- `app/` 웹을 웹뷰로 여는 Expo 앱 껍데기(`eas.json` 빌드 프로필, 자리표시 아이콘 포함). 안드로이드 에뮬레이터에서만 돌려 봤다. 자세한 것은 `app/README.md`.
- `api/` Cloudflare Worker + D1. 이벤트 · 제보 · 통계.
- `tools/` 린트 룰, JS 소스 금지 테스트, 로컬 PR 리뷰 틀(`tools/review/`), 개인정보 처리방침을 문서와 웹 페이지로 만드는 도구(`tools/privacy/`, `npm run privacy`).
- `scripts/` CI용 스크립트.
- `docs/` 과정 기록과 출시 준비(`release.md`, `device-checklist.md`, `store/`, `privacy.md`). 시작은 `docs/README.md`.
- `.github/workflows/` 검사 · 테스트 · 배포 · D1 만들기.

## 로컬에서 돌리기

```
npm ci
npm run check
npm run build
npm run build -w web
cp dist/*.json web/dist/
cd api
npx wrangler d1 migrations apply yeongkk --local
npx wrangler dev --port 8787
```

브라우저에서 `http://localhost:8787`을 열면 홈 화면이 뜬다. 게시 단어가 0개인 지금은 「아직 단어가 없어요. 곧 채울게요.」 안내가 보인다. 단어 파일을 `words/ko-KR/`에 넣고 `npm run build`부터 다시 하면 퀴즈를 풀 수 있다. `cp`가 필요한 것은 웹이 같은 주소에서 `/words.ko-KR.json`과 `/config.ko-KR.json`을 받기 때문이다(`web/src/data/loadWords.ts`).

## 테스트

```
npm test
npm test -w web
npm test -w api
npm run lint
npm run typecheck
npm run typecheck -w web
npm run typecheck -w api
npm run typecheck -w app
```

개인정보 처리방침을 고친 뒤에는 `npm run privacy`로 문서와 웹 페이지를 다시 만든다(어긋나면 테스트가 실패한다).

PR 리뷰는 `npm run review -- <PR 번호>` — 자세한 것은 `tools/review/README.md`.

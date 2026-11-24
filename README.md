# 뭔말이야

요즘 10~20대 신조어를 퀴즈로 맞히는 앱이다. 저장소와 코드 이름은 `yeongkk`로 그대로 둔다.
웹 퀴즈가 먼저고, Worker 하나가 웹 파일과 API를 같이 내준다. 앱의 웹뷰에서 여는 것은 나중 일이다.

## 아직 없는 것

- 배포된 곳이 없다. 배포 워크플로는 있지만 아직 한 번도 성공하지 못했다.
- 게시된 단어가 0개다(`words/ko-KR/`는 비어 있다).
- 앱 껍데기(`app/`)와 자동 수집은 없다.

## 폴더

- `words/` 게시 단어. PR로만 추가한다.
- `config/` 금칙어(`ko-KR/banned.txt`)와 원격 설정(`remote/ko-KR.json`).
- `schema/` 단어와 설정의 JSON 스키마.
- `registry/` 단어 등록 검사 · 묶기 · `add-word`(TypeScript).
- `quiz-core/` 한 판 구성 · 문제 · 채점 · 실험 배정. 화면 없는 순수 로직.
- `bridge/` 웹과 앱이 주고받는 메시지 규약. 자세한 것은 `bridge/README.md`.
- `web/` 퀴즈 웹(React + Vite).
- `api/` Cloudflare Worker + D1. 이벤트 · 제보 · 통계.
- `tools/` 린트 룰, JS 소스 금지 테스트, 로컬 PR 리뷰 틀(`tools/review/`).
- `scripts/` CI용 스크립트.
- `docs/` 과정 기록. 시작은 `docs/README.md`.
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
```

PR 리뷰는 `npm run review -- <PR 번호>` — 자세한 것은 `tools/review/README.md`.

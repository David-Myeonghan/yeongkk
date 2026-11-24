# 로컬 PR 리뷰

PR 하나를 `claude` 에게 리뷰시키는 도구다. 내 컴퓨터에서 돌린다.
리뷰어는 미리 만들어 둔 자료를 읽고, 정해진 절차로 판정하고, 파일 두 개를 쓴다.
게시는 그 파일을 검사한 뒤에 따로 한다.

## 다섯 단계

1. 자료 만들기. `review-context/` 에 PR 설명, diff, 바뀐 파일 목록, lint · 타입 · 테스트 결과를 만든다.
2. 기준. 리뷰어가 `guide.md` 의 기준을 읽는다.
3. 실패 구성과 반증. 리뷰어가 깨질 만한 경우를 하나 만들고 스스로 반박해 본다. 절차는 `adversarial.md` 에 있다.
4. 판정. 지적을 분류하고 `APPROVE` 또는 `REQUEST_CHANGES` 를 정한다. 본문 모양은 `output-rules.md` 에 있다.
5. 게시. 출력 모양을 검사하고, 통과하면 GitHub 리뷰로 올린다.

## 실행

PR 브랜치를 체크아웃한 상태에서 돌린다. 로컬 HEAD 가 PR 의 head 와 다르면 멈춘다.

```
npm run review -- 12            # 드라이 런. 파일만 만들고 멈춘다.
npm run review -- 12 --submit   # 검사를 통과하면 게시한다.
```

먼저 드라이 런으로 `review-out/review.md` 를 읽어 본다. 마음에 들면 `--submit` 으로 다시 돌린다.
다시 돌리면 리뷰어도 다시 돈다.

### 쌓인 PR

이 저장소의 PR 은 앞 PR 위에 쌓인다. 기본 비교 대상은 `origin/<PR 의 base 브랜치>` 라서 앞 PR 의 변경까지 딸려 온다.
이 PR 의 변경만 보려면 앞 PR 의 브랜치를 준다.

```
npm run review -- 13 --base feat/previous-pr
```

### 증분 리뷰

리뷰한 뒤 커밋이 더 올라왔으면 `--incremental` 을 붙인다.
내가 올린 가장 최근의 리뷰(첫 줄에 `yk-review` 표지가 있는 것)를 찾아 `previous-review.md` 로 주고, 그 리뷰의 head 이후 새 커밋만 보게 한다.
지난 리뷰가 없으면 이유를 말하고 0 이 아닌 값으로 끝난다.

## 주의: 믿을 수 있는 PR 에만

검사 단계에서 PR 의 코드가 이 컴퓨터에서 실행된다(`npm run lint` · `npm test` 등).
리뷰어 세션은 셸 명령을 실행할 수 있고, 내 `gh` · `claude` 로그인을 쓴다.
PR 의 글과 코드에 숨은 지시가 있을 수 있으니, 작성자를 믿을 수 있는 PR 에만 쓴다.

- 포크에서 온 PR 은 기본으로 거절한다. 알고 쓰려면 `--allow-fork` 를 붙인다.
- 시작할 때 작업 트리에 커밋 안 된 변경이 있으면 멈춘다(검사와 리뷰어가 읽는 코드와 게시되는 head 가 달라지므로). 먼저 커밋하거나 버린다.
- 리뷰어가 끝난 뒤 `git status` 가 깨끗하지 않으면(`review-context/` · `review-out/` 밖을 바꾸거나 만들었으면) 검사가 막고, 게시하지 않는다. git 이 무시하는 경로(`.gitignore`)는 보이지 않는다.
- 지난 리뷰 뒤로 브랜치가 다시 쓰였으면(`--incremental`) 멈추고 전체 리뷰를 권한다.

## 필요한 것

- `claude`, `gh`, `git` 이 PATH 에 있어야 한다.
- `claude` 와 `gh` 는 로그인되어 있어야 한다.
- 리뷰는 `claude` 가 로그인된 계정으로 돌아간다. PR 의 diff 와 설명이 그 서비스로 보내진다.
- 게시는 `gh` 가 로그인된 계정 이름으로 올라간다.

## 하지 않는 것

- CI 에서 돌지 않는다. 사람이 내 컴퓨터에서 돌린다.
- 머지하지 않는다. 승인도 리뷰를 올리는 것 이상은 하지 않는다. 내 PR 이면 GitHub 가 승인을 막으므로 `COMMENT` 로 올리고, 판정은 본문의 판정 줄에 남는다.
- 사람이 PR 을 읽는 일을 대신하지 않는다.

## 결과가 놓이는 곳

둘 다 git 이 무시하는 폴더다. 실행할 때마다 지우고 다시 만든다.

- `review-context/`: 리뷰어에게 준 자료. `pr.md`, `diff.patch`, `changed-files.txt`, `diagnostics.md`, `previous-review.md`(증분일 때만), `adversarial.md`, `output-rules.md`.
- `review-out/`: 리뷰어의 출력. `review.md`(본문), `decision.txt`(판정), `comments.json`(줄 코멘트, 있을 때만). 그 밖에 `execution.jsonl`(리뷰어 실행 기록), `payload.json`(게시한 요청).

본문이 8,000자를 넘거나, 표지 · 판정이 어긋나거나, 바뀌지 않은 줄에 코멘트를 달면 검사가 막는다. 메시지를 읽고 다시 돌린다.

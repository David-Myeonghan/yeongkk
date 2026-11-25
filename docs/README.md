# 과정 기록

> 결론: 「뭔말이야」(저장소 이름 `yeongkk`)를 만들면서 무엇을 왜 정했는지, 무엇이 틀렸는지를 문서로 남긴다. 계획한 것은 여덟이고 지금 쓴 것은 여섯이다. 출시 준비 문서 넷(방침 · 출시 순서 · 실기기 점검표 · 스토어 초안)은 따로 더했다.
> 초안은 AI가 쓰고 사람이 고친다. 각 문서 맨 위에 검토 상태를 적는다.

상태: 초안(2026-11-24, AI가 씀). David 확인 전.

| 문서 | 무엇을 | 언제 쓰나 |
| --- | --- | --- |
| [prd.md](prd.md) | 문제, 가설, 판정 숫자, 안 하는 것, 기능 요구사항(수용 기준과 그것을 확인하는 테스트) | 만들기 전(2026-11-22), 기능 요구사항은 2026-11-24 |
| [decisions.md](decisions.md) | 날짜 · 정한 것 · 버린 안 · 이유 | 정할 때마다 한 줄 |
| [adr/](adr/README.md) | 되돌리기 비싼 결정 하나를 한 파일에. 배경 · 후보 · 잃는 것 · 확인 방법 · 다시 볼 조건 | 지난 결정 여섯은 2026-11-24에 사후 기록, 이후 큰 결정이 날 때마다 |
| [bridge-matrix.md](bridge-matrix.md) | 웹과 앱 사이 규칙 여섯, 앱 버전별 동작 표 | 브릿지 구현 뒤(테스트 칸), 실기기 확인 뒤(실기기 칸) |
| [privacy.md](privacy.md) | 개인정보 처리방침. `tools/privacy/content.ts`에서 만든다(웹 `/privacy/`와 같은 내용) | 출시 전, 코드가 모으는 것이 바뀔 때 |
| [release.md](release.md) | 출시까지 남은 일을 순서대로. 「사람」과 「명령」, 멈췄을 때 표 | 출시 준비 때 |
| [device-checklist.md](device-checklist.md) | 실기기에서 확인할 것 전부를 한 표로(결과 칸은 비어 있다) | preview 빌드를 폰에 깐 뒤 |
| [store/](store/listing.ko.md) | 스토어 등록 초안: [등록 글](store/listing.ko.md) · [개인정보 신고](store/app-privacy.md) · [연령 등급](store/age-rating.md) · [심사 메모](store/review-notes.md) | 스토어 양식을 채울 때 |
| [ai-log.md](ai-log.md) | 작업마다 한 줄: 수용 기준 · AI가 만든 것 · 리뷰가 잡은 것 · 내가 잡은 것 · 근거 | 매일 |
| [experiment-funny-wrong.md](experiment-funny-wrong.md) | 「웃긴 오답」 실험의 가설 · 기준 · 결과 | 가설은 공개 전, 결과는 공개 뒤 |
| observation.md | 지인 5명이 푸는 것을 옆에서 본 기록 | 공개한 주 |
| metrics.md | 연 사람 → 시작 → 완주 → 공유 → 다음 날 재방문 | 공개한 날부터 매일 |

그 밖의 문서: [word-criteria.md](word-criteria.md) — 단어를 넣는 기준과 빼는 기준.

파일 이름에 링크가 없는 문서 둘(observation.md, metrics.md)은 아직 쓰지 않았다.

이 문서들이 말하는 코드와 테스트는 PR #6~#15에 있다. #6~#15(기반 · 브릿지 · 퀴즈 로직 · 설정 · 서버 · 웹 · 배포 · 전체 리뷰 수정 · JS를 TS로 · 로컬 리뷰 틀)는 모두 합침이다(#6은 2026-11-23, 나머지는 2026-11-24, 한국 시간). 문서 속 경로는 `main`에 있다.

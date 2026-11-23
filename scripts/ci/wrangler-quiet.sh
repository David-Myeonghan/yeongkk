#!/usr/bin/env bash
# wrangler 를 돌리고, 공개 로그에 계정 정보가 나가지 않게 걸러서 출력한다.
# 사용: wrangler-quiet.sh <wrangler 인자...>   (api/ 에서)
# 걸러내기만 따로: wrangler-quiet.sh --yk-filter <종료코드>  (표준입력 → 표준출력)
set -euo pipefail

filter() {
  local code="$1"
  sed -E 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[가림]/g' |
    if [ "$code" -eq 0 ]; then
      cat
    else
      awk '
        BEGIN { skipping = 0 }
        /Getting User settings|You are logged in|Account Name/ { skipping = 1 }
        skipping && (/^(🪵|Logs were written)/ || /^[[:space:]]*(✘|▲)/ || /\[ERROR\]|\[WARNING\]/) { skipping = 0 }
        skipping { next }
        /│|\|/ { next }
        /^[[:space:]]*(┌|├|└)/ { next }
        { print }
      '
      echo "계정 정보(계정 이름 · 토큰 권한 표)는 공개 로그에 남기지 않으려고 가렸습니다. 내 컴퓨터에서 npx wrangler whoami 로 확인하세요."
    fi
}

if [ "${1:-}" = "--yk-filter" ]; then
  filter "${2:?종료코드가 필요합니다}"
  exit 0
fi

out="$(mktemp)"
trap 'rm -f "$out"' EXIT
code=0
npm exec --no -- wrangler "$@" >"$out" 2>&1 || code=$?
filter "$code" <"$out"
exit "$code"

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 이상이 필요합니다: https://nodejs.org"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "블랙마켓 실행에 필요한 파일을 설치합니다..."
  npm install
fi

echo "블랙마켓을 시작합니다. 터미널에 표시되는 주소를 브라우저에서 여세요."
npm run dev

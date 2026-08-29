@echo off
chcp 65001 > nul
cd /d "%~dp0"

where node > nul 2>&1
if errorlevel 1 (
  echo [오류] Node.js 22 이상이 필요합니다.
  echo https://nodejs.org 에서 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

if not exist node_modules (
  echo 블랙마켓 실행에 필요한 파일을 설치합니다...
  call npm install
  if errorlevel 1 (
    echo [오류] 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)

echo.
echo 블랙마켓을 시작합니다. 터미널에 표시되는 주소를 브라우저에서 여세요.
call npm run dev
pause

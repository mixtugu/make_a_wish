#!/bin/bash
# Make a Wish (Expo판) – Expo 개발 서버 실행 (launchd 가 실행하는 파일, 직접 실행할 필요 없음)
# start.command 를 누르면 launchd 가 이 파일을 백그라운드에서 돌립니다.

source "$(dirname "$0")/common.sh"
load_config
mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR" || exit 1

# 재부팅 직후엔 Wi-Fi 가 늦게 붙으므로 IP 가 생길 때까지 최대 2분 대기
# (IP 없이 시작하면 기기가 접속할 주소가 잘못 잡힘)
for _ in $(seq 1 60); do
  ipconfig getifaddr en0 >/dev/null 2>&1 || ipconfig getifaddr en1 >/dev/null 2>&1 && break
  sleep 2
done

# 이전 실행이 남아 포트를 잡고 있으면 정리
pids="$(port_pids)"
if [ -n "$pids" ]; then
  echo "[$(date '+%F %T')] 포트 $PORT 를 쓰던 이전 프로세스 종료: $pids"
  kill $pids 2>/dev/null
  sleep 2
fi

echo "[$(date '+%F %T')] Expo 시작 – node $(node -v 2>/dev/null), IP $(lan_ip), port $PORT"

# CI=1: 키 입력을 기다리는 대화형 화면 없이 실행 (백그라운드용)
export CI=1
# caffeinate: 서버가 도는 동안 Mac 이 잠자기에 들어가지 않게 함
exec /usr/bin/caffeinate -ims npx expo start --go --lan --port "$PORT"

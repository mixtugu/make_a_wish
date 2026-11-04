#!/bin/bash
# Make a Wish (Expo판) – Expo 서버 종료
# 실행 중인 서버를 끕니다. 다시 켜려면 start.command

source "$(dirname "$0")/common.sh"
clear
echo "=============================================="
echo "  Make a Wish – Expo 서버 종료"
echo "=============================================="

if is_loaded; then
  # 작업을 내리면 launchd 가 Expo 와 caffeinate 를 함께 종료 (다시 시작하지 않음)
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
fi

# 혹시 남은 프로세스 정리
for _ in 1 2 3 4 5; do
  pids="$(port_pids)"
  [ -z "$pids" ] && break
  kill $pids 2>/dev/null
  sleep 1
done
pids="$(port_pids)"
[ -n "$pids" ] && kill -9 $pids 2>/dev/null

if is_running; then
  echo "  ✗ 아직 실행 중입니다. Mac 을 재시동하거나 활성 상태 보기에서 node 를 종료하세요."
  pause_exit 1
fi
echo "  ✓ 종료했습니다."
echo
echo "  다시 켜려면 start.command"
pause_exit 0

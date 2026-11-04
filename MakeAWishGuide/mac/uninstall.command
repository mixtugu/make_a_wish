#!/bin/bash
# Make a Wish (Expo판) – Mac 설정 정리
# 서버를 끄고 install.command 가 만든 백그라운드 실행 등록을 지웁니다. (프로젝트 파일·패키지는 그대로)

source "$(dirname "$0")/common.sh"
clear
echo "=============================================="
echo "  Make a Wish – Mac 설정 정리"
echo "=============================================="

if is_loaded; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
fi
pids="$(port_pids)"
[ -n "$pids" ] && kill $pids 2>/dev/null
rm -f "$PLIST"
echo "  ✓ 서버를 끄고 백그라운드 실행 등록을 지웠습니다."

if ask_yes "  저장된 Expo 토큰·Node 경로 설정(config.env)도 지울까요?" n; then
  rm -f "$CONFIG_FILE"
  echo "  ✓ 지웠습니다."
fi
echo
echo "  다시 쓰려면 install.command 를 실행하세요."
pause_exit 0

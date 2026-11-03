#!/bin/bash
# Make a Wish (Expo판) – Expo 서버 시작 (이미 실행 중이면 다시 시작)
# 창을 닫아도 서버는 백그라운드에서 계속 실행됩니다. 끄려면 stop.command

source "$(dirname "$0")/common.sh"
load_config
clear
echo "=============================================="
echo "  Make a Wish – Expo 서버 시작"
echo "=============================================="

if [ ! -f "$PLIST" ] || [ ! -f "$CONFIG_FILE" ]; then
  echo "  먼저 install.command 로 초기 설치를 해 주세요."
  pause_exit 1
fi

# 로그가 너무 커지면 비움 (10MB)
mkdir -p "$LOG_DIR"
if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE")" -gt 10485760 ]; then
  mv "$LOG_FILE" "$LOG_FILE.old"
fi

if ! is_loaded; then
  launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null
fi
launchctl kickstart -k "$DOMAIN/$LABEL"

printf "  시작 중"
for _ in $(seq 1 90); do
  if is_running; then
    break
  fi
  printf "."
  sleep 1
done
echo

if is_running; then
  echo "  ✓ 실행 중 (창을 닫아도 계속 실행됩니다)"
  print_connect_help
  echo "  실시간 로그를 보려면 Enter (보다가 닫으려면 창을 닫으세요)"
  read -r _
  tail -n 40 -f "$LOG_FILE"
else
  echo "  ✗ 시작하지 못했습니다. 최근 로그:"
  tail -n 30 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
  echo
  echo "  로그 전체: $LOG_FILE"
  pause_exit 1
fi

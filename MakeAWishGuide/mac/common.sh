#!/bin/bash
# Make a Wish (Expo판) – Mac 스크립트 공통 설정
# 다른 .command / .sh 파일이 source 해서 씁니다. (macOS 기본 bash 3.2 호환)

MAC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$MAC_DIR/.." && pwd)"

LABEL="com.makeawish.expo"                          # launchd 작업 이름
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"     # 백그라운드 실행 등록 파일 (로그인 시 자동 시작은 안 함)
LOG_DIR="$HOME/Library/Logs/MakeAWish"
LOG_FILE="$LOG_DIR/expo.log"
CONFIG_FILE="$MAC_DIR/config.env"                    # Node 경로, Expo 토큰 (git 에 올리지 않음)
PORT=8081
DOMAIN="gui/$(id -u)"
# Expo SDK 58 이 지원하는 Node: ^22.13.0 || ^24.3.0 || >=26 (23·25 같은 홀수 버전은 안 됨)
NODE_REQUIREMENT="22.13 이상의 22, 24.3 이상의 24, 또는 26 이상"

# 보호 폴더에 있을 때 install 이 옮기는 단위와 위치.
# 상위 폴더가 프로젝트 묶음(git 저장소, 서버·웹 폴더 포함)이면 묶음째로 홈 폴더 바로 아래로 옮김
if [ -d "$PROJECT_DIR/../.git" ] || [ -d "$PROJECT_DIR/../MakeAWishServer" ]; then
  MOVE_SRC="$(dirname "$PROJECT_DIR")"
  MOVE_DEST="$HOME/$(basename "$MOVE_SRC")"
  SAFE_PROJECT_DIR="$MOVE_DEST/$(basename "$PROJECT_DIR")"
else
  MOVE_SRC="$PROJECT_DIR"
  MOVE_DEST="$HOME/$(basename "$PROJECT_DIR")"
  SAFE_PROJECT_DIR="$MOVE_DEST"
fi

# macOS 는 바탕화면·문서·다운로드·iCloud·외장 디스크를 앱별로 보호합니다(TCC).
# 터미널은 허용받아도 백그라운드의 /bin/bash 는 허용이 없어 "Operation not permitted" 로 실행이 안 됨.
in_protected_folder() {
  case "$PROJECT_DIR/" in
    "$HOME/Desktop/"* | "$HOME/Documents/"* | "$HOME/Downloads/"* | "$HOME/Library/Mobile Documents/"* | /Volumes/*) return 0 ;;
  esac
  return 1
}

# 로그에 보호 폴더 접근 거부가 찍혔으면 안내
explain_permission_error() {
  if grep -q "Operation not permitted" "$LOG_FILE" 2>/dev/null; then
    echo
    echo "  ! 'Operation not permitted': 프로젝트가 macOS 보호 폴더(바탕화면·문서·다운로드 등)에 있어"
    echo "    백그라운드 실행이 파일을 읽지 못했습니다. install.command 를 다시 실행하면"
    echo "    $MOVE_DEST 로 옮겨서 해결합니다."
  fi
}

# 설정 파일을 읽고 Node 를 PATH 에 추가 (launchd 는 PATH 가 거의 비어 있음)
load_config() {
  if [ -f "$CONFIG_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
    set +a
  fi
  if [ -n "${NODE_BIN_DIR:-}" ]; then
    export PATH="$NODE_BIN_DIR:$PATH"
  fi
  export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
}

# 같은 Wi-Fi 의 기기가 접속할 Mac 의 IP
lan_ip() {
  local ip
  for iface in en0 en1 en2 en3; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null)"
    if [ -n "$ip" ]; then
      echo "$ip"
      return
    fi
  done
  echo "(IP 확인 불가 – Wi-Fi 연결을 확인하세요)"
}

is_loaded() {
  launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1
}

is_running() {
  curl -s --max-time 2 "http://localhost:$PORT/status" 2>/dev/null | grep -q "packager-status:running"
}

port_pids() {
  lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null
}

# KEY='value' 형식으로 안전하게 저장 (작은따옴표 이스케이프)
write_kv() {
  local key="$1" value="$2"
  value="${value//\'/\'\\\'\'}"
  printf "%s='%s'\n" "$key" "$value"
}

xml_escape() {
  local s="$1"
  s="${s//&/&amp;}"
  s="${s//</&lt;}"
  s="${s//>/&gt;}"
  printf '%s' "$s"
}

# 기본값이 있는 입력 (bash 3.2 에는 read -i 가 없음)
ask() {
  local prompt="$1" default="$2" answer
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " answer
    echo "${answer:-$default}"
  else
    read -r -p "$prompt: " answer
    echo "$answer"
  fi
}

ask_yes() {
  local prompt="$1" default="${2:-y}" answer
  read -r -p "$prompt $( [ "$default" = y ] && echo '[Y/n]' || echo '[y/N]' ): " answer
  answer="${answer:-$default}"
  case "$answer" in
    y | Y | yes | YES | 예 | ㅇ) return 0 ;;
    *) return 1 ;;
  esac
}

print_connect_help() {
  local ip
  ip="$(lan_ip)"
  echo
  echo "  iPhone / iPad 에서 여는 방법 (Mac 과 같은 Wi-Fi 필요):"
  echo "   1) Expo Go 앱 → Mac 과 같은 Expo 계정으로 로그인"
  echo "   2) 첫 화면 'Development servers' 목록에서 Make a Wish 선택"
  echo "      또는 'Enter URL manually' 에  exp://$ip:$PORT  입력"
  echo
}

pause_exit() {
  echo
  read -r -p "Enter 를 누르면 이 창을 닫습니다…" _
  exit "${1:-0}"
}

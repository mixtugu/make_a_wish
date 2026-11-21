#!/bin/bash
# Make a Wish (Expo판) – Mac 초기 설치
#  1) Node.js 확인/설치   2) 패키지 설치   3) Expo 로그인
#  4) 서버 주소·토큰 저장 5) 백그라운드 실행 등록   6) 바로 시작
# 여러 번 실행해도 안전합니다 (설정을 바꾸고 싶을 때 다시 실행).

source "$(dirname "$0")/common.sh"
cd "$PROJECT_DIR" || exit 1
clear
echo "=============================================="
echo "  Make a Wish (Expo판) – Mac 초기 설치"
echo "=============================================="
echo "  프로젝트: $PROJECT_DIR"
echo

# 0. 보호 폴더(바탕화면 등)에 있으면 백그라운드 실행이 안 되므로 홈 폴더로 옮김
if in_protected_folder; then
  echo "  ! 프로젝트가 macOS 보호 폴더 안에 있습니다:"
  echo "      $PROJECT_DIR"
  echo "    여기서는 백그라운드 서버가 파일을 읽지 못합니다 ('Operation not permitted')."
  echo "    홈 폴더 바로 아래로 옮기면 해결됩니다:"
  echo "      $MOVE_SRC"
  echo "      → $MOVE_DEST"
  if [ -e "$MOVE_DEST" ]; then
    echo
    echo "  ✗ $MOVE_DEST 가 이미 있습니다. 지우거나 이름을 바꾼 뒤 다시 실행해 주세요."
    pause_exit 1
  fi
  if ask_yes "  지금 옮길까요?" y; then
    # 이전에 등록된 백그라운드 작업(옛 경로)을 먼저 내림
    is_loaded && launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
    cd "$HOME" || exit 1
    if ! mv "$MOVE_SRC" "$MOVE_DEST"; then
      echo "  ✗ 옮기지 못했습니다. Finder 에서 직접 홈 폴더로 옮긴 뒤 그 안의 install.command 를 실행해 주세요."
      pause_exit 1
    fi
    echo "  ✓ 옮겼습니다. 이제부터는 이 폴더의 파일을 쓰세요: $SAFE_PROJECT_DIR/mac"
    open "$SAFE_PROJECT_DIR/mac"
    echo
    exec /bin/bash "$SAFE_PROJECT_DIR/mac/install.command"
  fi
  echo "  계속 진행하지만 서버가 시작되지 않을 수 있습니다."
  echo
fi

# 다른 스크립트 실행 권한 + 인터넷에서 받은 파일 격리 표시 제거
chmod +x "$MAC_DIR"/*.command "$MAC_DIR"/*.sh 2>/dev/null
xattr -dr com.apple.quarantine "$MAC_DIR" 2>/dev/null

# 1. Node.js ───────────────────────────────────────────────
echo "[1/6] Node.js 확인"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local v major minor
  v="$(node -p 'process.versions.node' 2>/dev/null)" || return 1
  major="${v%%.*}"
  minor="${v#*.}"
  minor="${minor%%.*}"
  case "$major" in
    22) [ "$minor" -ge 13 ] ;;
    24) [ "$minor" -ge 3 ] ;;
    *) [ "$major" -ge 26 ] ;;
  esac
}

if ! node_ok; then
  if command -v node >/dev/null 2>&1; then
    echo "  설치된 Node.js $(node -v) 는 Expo 가 지원하지 않는 버전입니다 (필요: $NODE_REQUIREMENT)."
  else
    echo "  Node.js 가 없습니다."
  fi
  if command -v brew >/dev/null 2>&1; then
    if ask_yes "  Homebrew 로 Node.js 를 설치/업데이트할까요?" y; then
      # 이미 설치돼 있으면 brew install 은 아무것도 안 하고 성공하므로 upgrade 를 따로 실행
      if brew list --versions node >/dev/null 2>&1; then
        brew upgrade node
      else
        brew install node
      fi
      hash -r
    fi
  fi
  if ! node_ok; then
    echo
    echo "  nodejs.org 에서 'LTS' 버전 macOS 설치 파일(.pkg)을 받아 설치한 뒤"
    echo "  이 파일(install.command)을 다시 실행해 주세요."
    open "https://nodejs.org/en/download"
    pause_exit 1
  fi
fi
NODE_BIN_DIR="$(dirname "$(command -v node)")"
echo "  ✓ Node.js $(node -v)  ($NODE_BIN_DIR)"
echo

# 2. 패키지 설치 ────────────────────────────────────────────
echo "[2/6] 패키지 설치 (처음엔 몇 분 걸립니다)"
if ! npm install --no-fund --no-audit; then
  echo "  ✗ 패키지 설치 실패 – 인터넷 연결을 확인하고 다시 실행해 주세요."
  pause_exit 1
fi
echo "  ✓ 완료"
echo

# 3. Expo 로그인 ────────────────────────────────────────────
echo "[3/6] Expo 로그인 (iPhone·iPad 의 Expo Go 와 같은 계정이어야 합니다)"
EXPO_TOKEN_VALUE=""
if [ -f "$CONFIG_FILE" ]; then
  EXPO_TOKEN_VALUE="$(
    set -a
    . "$CONFIG_FILE"
    echo "${EXPO_TOKEN:-}"
  )"
fi
if [ -n "$EXPO_TOKEN_VALUE" ] && EXPO_TOKEN="$EXPO_TOKEN_VALUE" npx expo whoami >/dev/null 2>&1; then
  echo "  ✓ 저장된 토큰으로 로그인됨: $(EXPO_TOKEN="$EXPO_TOKEN_VALUE" npx expo whoami 2>/dev/null)"
elif EXPO_TOKEN_VALUE="" && npx expo whoami >/dev/null 2>&1; then
  echo "  ✓ 로그인됨: $(npx expo whoami 2>/dev/null)"
else
  EXPO_TOKEN_VALUE=""
  echo "  로그인 방법을 고르세요."
  echo "   - 액세스 토큰 (권장, 구글로 가입한 계정도 가능):"
  echo "     expo.dev → 프로필 → Account settings → Access tokens → Create token"
  echo "   - 아무것도 입력하지 않고 Enter: 아이디/비밀번호로 로그인"
  read -r -s -p "  Expo 액세스 토큰: " EXPO_TOKEN_VALUE
  echo
  if [ -n "$EXPO_TOKEN_VALUE" ]; then
    if EXPO_TOKEN="$EXPO_TOKEN_VALUE" npx expo whoami >/dev/null 2>&1; then
      echo "  ✓ 로그인됨: $(EXPO_TOKEN="$EXPO_TOKEN_VALUE" npx expo whoami 2>/dev/null)"
    else
      echo "  ✗ 토큰이 올바르지 않습니다. 다시 실행해 주세요."
      pause_exit 1
    fi
  else
    npx expo login || {
      echo "  ✗ 로그인 실패. 토큰 방식으로 다시 시도해 주세요."
      pause_exit 1
    }
  fi
fi
echo

# 4. 서버 주소·토큰 (.env.local → 앱의 기본 설정값) ─────────
echo "[4/6] Make a Wish 서버 연결 정보"
ENV_LOCAL="$PROJECT_DIR/.env.local"
write_env=true
if [ -f "$ENV_LOCAL" ]; then
  echo "  이미 저장된 값이 있습니다:"
  grep -E '^EXPO_PUBLIC_SERVER_URL=' "$ENV_LOCAL" | sed 's/^/    /'
  ask_yes "  새로 입력할까요?" n || write_env=false
fi
if [ "$write_env" = true ]; then
  SERVER_URL="$(ask "  서버 주소" "https://make-a-wish-server.timmy007900.workers.dev")"
  SERVER_URL="${SERVER_URL%/}"
  read -r -s -p "  API 토큰 (서버의 .secrets.env 에 넣은 값, 입력해도 화면에 안 보임): " API_TOKEN_VALUE
  echo
  {
    echo "# install.command 가 만든 파일 – 앱의 기본 서버 설정 (기기 설정 화면에서 바꿀 수 있음)"
    echo "EXPO_PUBLIC_SERVER_URL=$SERVER_URL"
    echo "EXPO_PUBLIC_API_TOKEN=$API_TOKEN_VALUE"
  } >"$ENV_LOCAL"
  chmod 600 "$ENV_LOCAL"
  if curl -s --max-time 8 -H "Authorization: Bearer $API_TOKEN_VALUE" "$SERVER_URL/api/current" | grep -q '"rows"'; then
    echo "  ✓ 서버 연결 확인"
  else
    echo "  ! 서버에 연결하지 못했습니다 (주소/토큰 확인). 나중에 앱 설정에서 바꿀 수도 있습니다."
  fi
fi
echo

# 설정 저장 (Node 경로, Expo 토큰)
{
  echo "# install.command 가 만든 파일 – git 에 올리지 마세요"
  write_kv NODE_BIN_DIR "$NODE_BIN_DIR"
  [ -n "$EXPO_TOKEN_VALUE" ] && write_kv EXPO_TOKEN "$EXPO_TOKEN_VALUE"
} >"$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

# 5. 백그라운드 실행 등록 (launchd) ─────────────────────────
#  - start.command 를 눌렀을 때만 켜짐 (Mac 을 켜거나 로그인할 때 저절로 켜지지 않음)
#  - 켜져 있는 동안 비정상 종료되면 자동으로 다시 시작
echo "[5/6] 백그라운드 실행 등록"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml_escape "$MAC_DIR/run-expo.sh")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$PROJECT_DIR")</string>
  <!-- 로그인 시 자동으로 켜지 않음: start.command 로만 시작 -->
  <key>RunAtLoad</key>
  <false/>
  <!-- 비정상 종료 시에만 다시 시작 (stop.command 로 끈 경우는 다시 켜지지 않음) -->
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$LOG_FILE")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$LOG_FILE")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>LANG</key>
    <string>en_US.UTF-8</string>
  </dict>
</dict>
</plist>
PLIST
if ! plutil -lint "$PLIST" >/dev/null; then
  echo "  ✗ 백그라운드 실행 등록 파일 생성 실패: $PLIST"
  pause_exit 1
fi
# 이미 등록돼 있으면 새 설정으로 다시 등록
if is_loaded; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null
  sleep 1
fi
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "  ✓ 등록됨 (start.command 로 시작 / stop.command 로 종료)"
echo

# 6. 지금 시작 ──────────────────────────────────────────────
echo "[6/6] Expo 서버 시작"
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
  echo "  ✓ 실행 중"
  print_connect_help
else
  echo "  ! 아직 시작되지 않았습니다. 잠시 후 start.command 로 상태를 확인하세요."
  echo "    로그: $LOG_FILE"
  tail -n 20 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
  explain_permission_error
fi

echo "----------------------------------------------"
echo "  전시용 Mac 권장 설정 (시스템 설정):"
echo "   - 배터리/에너지: '디스플레이가 꺼져 있을 때 자동으로 잠자기 방지' 켜기"
echo "   - 노트북은 덮개를 닫지 마세요 (닫으면 잠자기)"
echo "   - 방화벽 경고가 뜨면 node 의 '수신 연결 허용'"
echo "   - Mac 을 다시 켠 뒤에는 start.command 를 실행하세요"
echo "----------------------------------------------"
pause_exit 0

# Mac 에서 Expo 서버 운영하기

Expo Go 로 앱을 쓰려면 Expo 서버가 켜져 있어야 합니다. 이 폴더의 파일로 Mac 을
**전시용 서버**로 만들 수 있습니다.

- `start.command` 를 눌렀을 때만 켜집니다. Mac 을 켜거나 로그인할 때 저절로 켜지지 않습니다.
- 켜져 있는 동안은 창을 닫아도 백그라운드에서 계속 돌고, 비정상으로 꺼지면 자동으로 다시 켜집니다.
- 켜져 있는 동안 Mac 이 잠자기에 들어가지 않습니다.

| 파일 | 하는 일 |
| --- | --- |
| `install.command` | **처음 한 번**. Node.js 확인/설치 → 패키지 설치 → Expo 로그인 → 서버 주소·토큰 저장 → 백그라운드 실행 등록 → 시작 |
| `start.command` | 서버 시작 (켜져 있으면 다시 시작). 접속 주소와 로그를 보여 줌. 창을 닫아도 서버는 계속 실행 |
| `stop.command` | 서버 종료 |
| `uninstall.command` | 서버를 끄고 install.command 가 만든 등록을 정리 (다시 쓰려면 install.command) |
| `run-expo.sh`, `common.sh` | 위 파일들이 사용하는 내부 파일 (직접 실행할 필요 없음) |

## 처음 설치

1. 이 프로젝트를 Mac 으로 가져옵니다 (git clone 권장. 복사한다면 `node_modules` 폴더는 빼고).
2. **처음 한 번만** 터미널에서 실행합니다. Windows 에서 만든 파일은 실행 권한이 없어서 더블클릭이 안 됩니다.
   - 터미널 앱을 열고 `bash ` (끝에 띄어쓰기) 를 입력합니다.
   - Finder 에서 `install.command` 를 터미널 창으로 끌어다 놓고 Enter 를 누릅니다.
3. 안내에 따라 입력합니다.
   - **Expo 로그인**: 구글로 가입한 계정이면 **액세스 토큰**을 쓰세요.
     토큰은 expo.dev → 프로필 → Account settings → Access tokens → Create token 에서 만듭니다.
     iPhone·iPad 의 Expo Go 와 **같은 계정**이어야 합니다.
   - **API 토큰**: 서버 배포 때 `.secrets.env` 에 넣은 값입니다. 앱에 기본값으로 들어가므로 기기마다 따로 입력할 필요가 없습니다.
4. 설치가 끝나면 `start.command` / `stop.command` 를 **더블클릭**으로 쓸 수 있습니다.

설정을 바꾸고 싶으면(토큰, 서버 주소) `install.command` 를 다시 실행하면 됩니다.
Mac 을 다시 켠 뒤에는 `start.command` 를 한 번 실행하세요.

## iPhone / iPad 에서 열기

- Mac 과 **같은 Wi-Fi** 에 연결합니다.
- Expo Go 를 열고 Mac 과 같은 계정으로 로그인한 뒤, **Development servers** 에서 Make a Wish 를 선택합니다.
- 목록에 안 보이면 **Enter URL manually** 에 `start.command` 가 알려 주는 `exp://<Mac IP>:8081` 을 입력합니다.

## 전시용 Mac 권장 설정 (시스템 설정)

- **배터리/에너지**: '디스플레이가 꺼져 있을 때 자동으로 잠자기 방지'를 켭니다. 서버가 도는 동안은 스크립트도 잠자기를 막습니다.
- **노트북**은 덮개를 닫으면 잠자기에 들어가니 열어 둡니다.
- **방화벽**: 처음 실행할 때 "node 가 수신 연결을 허용하겠습니까?" 가 뜨면 **허용**합니다.
- **IP 고정**: Mac 의 IP 가 바뀌면 직접 입력한 주소가 달라집니다. Development servers 목록으로 열면 상관없습니다.

## 문제 해결

| 증상 | 확인 |
| --- | --- |
| 기기에서 프로젝트가 안 보임 | 같은 Wi-Fi 인지, Expo Go 와 Mac 이 같은 Expo 계정인지 확인 |
| "signed in to Expo CLI" 오류 | `install.command` 를 다시 실행해 액세스 토큰 입력 |
| 시작이 안 됨 | `start.command` 화면의 로그, 또는 `~/Library/Logs/MakeAWish/expo.log` |
| 회사·학교 Wi-Fi 에서 접속 불가 | 기기끼리 통신을 막는 네트워크일 수 있음. 휴대용 공유기/핫스팟 사용 |

백그라운드 실행은 macOS 의 launchd 로 등록되며(로그인 시 자동 시작은 꺼져 있음), 등록 파일은 `~/Library/LaunchAgents/com.makeawish.expo.plist` 입니다.

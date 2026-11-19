# Make a Wish 가이드 (React Native)

원본 SwiftUI 앱 두 개(Peiyao iPhone / iPad Guide)를 **하나의 React Native(Expo) 앱**으로 합친 프로젝트입니다.
두 기기는 [`../MakeAWishServer`](../MakeAWishServer) (Cloudflare Workers) 를 통해 상태를 주고받습니다.
같은 앱을 iPhone 과 iPad 에 설치한 뒤, 기기마다 **iPhone 가이드 / iPad 가이드** 중 하나로 설정해 사용합니다.

| 모드 | 역할 (원본) |
| --- | --- |
| **iPhone 가이드** | 대기 화면 "Make a Wish" → iPad 에서 소원을 저장하면 "소원 종이를 대 주세요" NFC 안내 화면 (`MainView`, `NFCView`) |
| **iPad 가이드** | 소개(일본어/영어 전환) → 신분 선택 → 신분에 따라 **소원 기록**과 **소원 해제** 순서가 다름 → 감사 화면 (9개 화면, 아래 표) |

### iPad 체험 흐름 (2026-11 수정)

| 신분 | 표시 언어 | 순서 |
| --- | --- | --- |
| 외국인 | 첫 화면에서 고른 언어 (日本語 / EN) | 소원 쓰기 → **빨간** 카드에 기록 → **노란** 카드 해제 |
| 일본인 | 항상 일본어 (영어를 골랐어도 일본인 선택 시 전환) | **빨간** 카드 해제 → 소원 쓰기 → **노란** 카드에 기록 |

- 기록 = 소원 그리기 → 카드를 스마트폰에 태그 → 끈에 묶기 → 저장 완료 / 해제 = 끈에서 카드를 떼어 태그 → 소원 열림
- 서로 상대의 카드를 푸는 "願いの交換" (외국인 소원은 빨강, 일본인 소원은 노랑). 기존 카드 그림과 같은 규칙
- 언어 전환 버튼은 첫 화면 오른쪽 위에만 있음. 매 방문은 일본어로 시작
- 순서 정의: `src/modes/ipad/flow.ts`, 신분별 문구(질문·카드 안내): `src/i18n/strings.ts` 의 `flowStrings`

---

## 1. 빠른 시작

```bash
cd MakeAWishGuide
npm install
npx expo start            # Expo Go 로 바로 확인 (NFC 직접 읽기 제외 전부 동작)
```

> Windows 에서는 iOS 네이티브 빌드를 할 수 없으므로 **EAS 클라우드 빌드**를 쓰세요 (아래 4번).

**전시용으로 Mac 을 Expo 서버로 쓰려면** [`mac/`](mac/README.md) 의 스크립트를 사용하세요.
초기 설치와 시작/종료를 더블클릭으로 할 수 있고, 켜져 있는 동안은 백그라운드에서 계속 실행됩니다.

## 2. 모드(버전) 설정

- **최초 실행** 시 "이 기기를 어떤 가이드로 사용할까요?" 화면이 나오고, 기기에 맞는 쪽이 추천 표시됩니다.
- 이후 변경: 화면 **오른쪽 위 모서리를 2초간 길게 누르기** → 관리자 메뉴 → **설정**
  - 관람객에게는 보이지 않는 영역이라 전시 중 실수로 열리지 않습니다.

설정 항목:

| 구분 | 항목 | 기본값 |
| --- | --- | --- |
| 공통 | 가이드 모드 (자동 / iPhone / iPad) | 자동 = iPad 면 iPad 가이드 |
| 공통 | 화면 꺼짐 방지 | 켜짐 |
| 공통 | 실시간 업데이트 (WebSocket) | 켜짐 |
| 공통 | 실시간 연결이 없을 때의 확인 주기 | 1500ms (원본과 동일) |
| 공통 | 서버 주소 / API 토큰, **연결 테스트** | `.env.local` 값 |
| iPad | 매 방문 시작 언어 | 日本語 |
| iPad | 입력 없으면 처음으로 (초) | 0 = 끔 |
| iPhone | 앱에서 NFC 태그 직접 읽기 | 꺼짐 (원본 동작) |
| 관리 | currentdata 비우기 / 설정 초기화 | — |

관리자 메뉴의 **처음 화면으로**는 진행 중인 체험을 즉시 초기화합니다.

## 3. 서버 연결

1. [`../MakeAWishServer`](../MakeAWishServer/README.md) 를 Cloudflare 에 배포 (README 의 명령 4줄)
2. 배포 주소(`https://make-a-wish-server.<계정>.workers.dev`)와 API_TOKEN 을
   - `.env.example` → `.env.local` 로 복사해 넣거나 (빌드 기본값)
   - 각 기기의 앱 설정 화면 → **서버** 에 입력 → **연결 테스트**
3. iPhone 과 iPad 가 **같은 주소·토큰**을 쓰는지 확인

> `.env.local` 에 넣은 토큰은 앱 안에 그대로 들어갑니다. 전시용 공유 토큰으로만 쓰고, 유출되면 서버에서 바꾸세요.

기기들은 서버와 **WebSocket 하나**로 연결되어, 상태가 바뀌면 서버가 바로 알려 줍니다 (원본처럼 1.5초마다 묻지 않음).
연결이 안 되는 환경에서는 자동으로 주기적 확인으로 바뀌고, 다시 연결되면 복귀합니다.
현재 연결 상태는 ⚙︎ 메뉴의 `Server:` 줄에서 볼 수 있고, 설정의 *Real-time updates* 로 끌 수 있습니다.

### 데이터 흐름 (원본과 동일 – 일본인은 아래 "해제" 부분이 먼저, "기록" 부분이 나중)

```
iPad  소원 그리기 완료      POST /api/current   currentdata ← {status: waiting}
iPhone                      waiting 감지 → "make a wish" NFC 안내 화면
(태그)                      POST /api/tag       waiting → nfctagged, nfc_id 기록
iPad                        nfctagged 감지 → POST /api/lock (그림 PNG)
                            → R2 에 그림 저장, lockeddata {status: locked, image_url} 추가, currentdata 정리
iPad  해제 단계 시작        POST /api/current   currentdata ← {status: unlockwaiting}
iPhone                      "fulfill someone's wish" 안내 화면
(태그)                      POST /api/tag       unlockwaiting → unlocknfctagged, nfc_id 기록
iPad                        unlocknfctagged 감지 → POST /api/unlock
                            → nfc_id 로 lockeddata 조회 → unlockeddata {status: unlocked} 추가, 정리
iPad  감사 화면             DELETE /api/current currentdata 전체 정리
```

**누가 `nfctagged` 로 바꾸나요?** 원본 iPhone 앱에는 NFC 읽기 코드가 없어서 외부(예: iOS 단축어 NFC 자동화)가 처리했던 것으로 보입니다.
- 단축어를 쓰려면 설정의 *앱에서 NFC 태그 직접 읽기* 를 **끈 채로** 두고, 단축어가 `POST /api/tag` 를 호출하게 하세요 ([서버 README](../MakeAWishServer/README.md#단축어로-태그-처리하기-앱의-nfc-직접-읽기를-끈-경우)).
- 켜면 iPhone 앱이 NFC 안내 화면에서 직접 태그 UID 를 읽어(`nfc_id` = UID 16진수 대문자) 상태를 바꿉니다. (NTAG/MIFARE Ultralight, ISO15693 태그 지원 · 개발 빌드 필요)

### 브라우저에서 iPad·iPhone 두 화면 동시에 테스트

```bash
npx expo start --web          # 이미 expo start 가 실행 중이면 그 터미널에서 w
```

브라우저 **창 두 개**를 나란히 띄우고 각각 아래 주소를 엽니다 (한 창의 탭 두 개는 안 됨 – 가려진 탭은 브라우저가 멈춤).

- iPad 화면: `http://localhost:8081/?mode=ipad`
- iPhone 화면: `http://localhost:8081/?mode=iphone`

처음 한 번 ⚙︎ → Settings 에서 서버 주소·토큰을 확인하고 **Test mode** 를 켭니다 (두 창이 설정을 함께 씀).
iPad 창에서 진행하면 iPhone 창이 바뀌고, 카드 버튼(Red / Yellow)으로 태그를 흉내 냅니다.

- 브라우저 → 서버 요청은 개발 서버가 대신 전달합니다 (`metro.config.js`, 브라우저 CORS 제한 때문). 서버 수정·재배포 불필요
- 브라우저에서는 실시간 연결 대신 1.5초마다 확인, 그리기는 HTML canvas (`*.web.tsx`). iPhone/iPad 앱에는 영향 없음
- 글꼴·안전 영역 차이로 실제 기기와 모양이 조금 다를 수 있음. 실제 서버에 데이터가 저장됨 (테스트 모드와 같음)

### 화면 미리보기 (서버·NFC 없이 모양만)

⚙︎ → **Screen preview (no server)** → iPad(외국인·일본어 / 외국인·영어 / 일본인) 또는 iPhone 을 고르면,
체험 순서대로 화면을 아래 **◀ ▶** 로 넘겨 볼 수 있습니다. 서버 요청·태그 반응을 하지 않아 데이터가 남지 않습니다. ✕ 로 닫기.

### 테스트 모드 (NFC 없이 확인)

⚙︎ → Settings → **Test mode** 를 켜면, 태그를 기다리는 화면(iPad 기록·해제 화면, iPhone NFC 안내 화면)에
가상 카드 버튼(**Red 1–3, Yellow 1–3**)이 나옵니다. 버튼을 누르면 실제 태그와 같은 요청(`POST /api/tag`)을 보내므로
기록·해제·그림 저장·프로젝터 표시까지 실제와 똑같이 진행됩니다. iPhone 없이 iPad 한 대로도 전체 흐름을 볼 수 있고, Expo Go 에서도 됩니다.

- 그 단계에서 써야 하는 색이 진하게 표시됩니다 (외국인: 빨강 기록·노랑 해제 / 일본인: 노랑 기록·빨강 해제)
- 이 기기에서 소원을 기록한 카드에는 **✓ wish** 표시 → 해제 테스트 때 그 카드를 누르면 실제로 소원이 풀립니다
- 켜져 있는 동안 화면 왼쪽 위에 빨간 **TEST MODE** 표시. 전시 전에 꼭 끄세요
- 테스트 소원도 실제 서버에 저장되어 프로젝터에 나옵니다 (프로젝터 화면에서 X 로 내릴 수 있음)

예) 외국인으로 Red 1 에 기록 → 다음 방문을 일본인으로 시작해 Red 1 해제 → Yellow 1 에 기록 → 다음 외국인이 Yellow 1 해제

## 4. 기기에 설치 (EAS 빌드)

NFC 모듈 때문에 실제 배포는 Expo Go 가 아닌 빌드가 필요합니다. Mac 없이도 됩니다.

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p ios --profile preview       # 내부 배포용 (설치 링크/QR)
npx eas-cli@latest build -p ios --profile development   # 개발용 (expo start 와 연결, 핫 리로드)
```

- Apple Developer 계정이 필요합니다. 팀 ID 는 원본 Xcode 프로젝트와 같은 `YC76GD2A26` 로 설정해 두었습니다 (`app.json`).
- 번들 ID: `assignment.Peiyao-Guide` (하나의 앱으로 통합되어 원본 두 ID 와 다름)
- Mac 이 있다면 `npm run ios:device` 로 로컬 빌드도 가능합니다.

## 5. 프로젝트 구조

```
App.tsx                         루트: 설정 로드 → (최초 설정) → 모드별 가이드 + 관리자 메뉴
src/
  config/defaults.ts            기본 설정값, 테이블/상태 상수
  settings/SettingsContext.tsx  기기별 설정 저장 (AsyncStorage)
  i18n/strings.ts               문구 (일본어 / 영어) + 신분별 문구 flowStrings
  fonts.ts                      언어별 폰트 (원본 FontManager)
  services/api.ts               Make a Wish 서버(Cloudflare Worker) 클라이언트
  services/wishFlow.ts          단계별 서버 호출 (원본 각 View 의 네트워크 코드)
  live/LiveCurrent.tsx          서버 상태 실시간 수신 (WebSocket, 끊기면 폴링으로 대체)
  services/nfc.ts               NFC 태그 UID 읽기 (선택)
  components/DrawingCanvas.tsx  PencilKit 대체 드로잉 캔버스 (Skia)
  modes/iphone/IPhoneGuide.tsx  iPhone 가이드
  modes/ipad/IPadGuide.tsx      iPad 가이드 흐름 + screens/ 9개 화면
  modes/ipad/flow.ts            신분별 화면 순서 (일본인 / 외국인), 단계별 카드 색
  testmode/                     테스트 모드 (가상 NFC 카드 버튼)
  admin/                        최초 설정, 관리자 메뉴, 설정 화면
  assets/svgs.ts                원본 SVG 에셋 (변환해 둔 데이터)
assets/fonts, assets/images     원본 폰트 / 이미지
```

## 6. 원본 대비 달라진 점

- 두 앱 → 한 앱 + 기기별 모드 설정, 숨겨진 관리자 메뉴
- 드로잉: PencilKit → Skia 캔버스. 색상 6개, 펜/지우개(획 단위, PencilKit vector 지우개와 동일), 굵기 4단계, **되돌리기·전체 지우기** 추가
- 저장 이미지는 원본처럼 그림 영역 + 8pt 여백을 흰 배경 PNG 로 잘라 업로드
- 백엔드: Supabase → Cloudflare Workers + D1 + R2. 이관 작업을 서버에서 트랜잭션으로 처리해, 중간에 네트워크가 끊겨도 데이터가 반만 옮겨지지 않음
- iPhone 문구 오타 수정: `somepne's` → `someone's`
- 상태 확인은 앱이 백그라운드일 때 멈추고 돌아오면 재개 (원본 scenePhase 처리와 동일)
- 화면 꺼짐 방지, (선택) 대기 시간 초과 시 처음으로, 앱 내 NFC 읽기
- (2026-11) 언어는 일본어·영어만, 첫 화면 오른쪽 위 전환 버튼 / 신분별 체험 순서 분기 / 소원 질문 문구 통일 / 카드 안내에 색 명시

## 7. 개발 명령

```bash
npm run typecheck     # tsc
npm run lint          # eslint
npx expo-doctor       # 의존성/설정 점검
```

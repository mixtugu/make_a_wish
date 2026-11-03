# Make a Wish 가이드 (React Native)

원본 SwiftUI 앱 두 개(Peiyao iPhone / iPad Guide)를 **하나의 React Native(Expo) 앱**으로 합친 프로젝트입니다.
두 기기는 [`../MakeAWishServer`](../MakeAWishServer) (Cloudflare Workers) 를 통해 상태를 주고받습니다.
같은 앱을 iPhone 과 iPad 에 설치한 뒤, 기기마다 **iPhone 가이드 / iPad 가이드** 중 하나로 설정해 사용합니다.

| 모드 | 역할 (원본) |
| --- | --- |
| **iPhone 가이드** | 대기 화면 "Make a Wish" → iPad 에서 소원을 저장하면 "소원 종이를 대 주세요" NFC 안내 화면 (`MainView`, `NFCView`) |
| **iPad 가이드** | 언어 선택 → 신분 선택 → 에마에 소원 그리기 → 종이 태그 → 끈에 묶기 → 다른 사람의 종이 풀기 → 감사 화면 (9개 화면) |

---

## 1. 빠른 시작

```bash
cd MakeAWishGuide
npm install
npx expo start            # Expo Go 로 바로 확인 (NFC 직접 읽기 제외 전부 동작)
```

> Windows 에서는 iOS 네이티브 빌드를 할 수 없으므로 **EAS 클라우드 빌드**를 쓰세요 (아래 4번).

## 2. 모드(버전) 설정

- **최초 실행** 시 "이 기기를 어떤 가이드로 사용할까요?" 화면이 나오고, 기기에 맞는 쪽이 추천 표시됩니다.
- 이후 변경: 화면 **오른쪽 위 모서리를 2초간 길게 누르기** → 관리자 메뉴 → **설정**
  - 관람객에게는 보이지 않는 영역이라 전시 중 실수로 열리지 않습니다.

설정 항목:

| 구분 | 항목 | 기본값 |
| --- | --- | --- |
| 공통 | 가이드 모드 (자동 / iPhone / iPad) | 자동 = iPad 면 iPad 가이드 |
| 공통 | 화면 꺼짐 방지 | 켜짐 |
| 공통 | 상태 확인 주기 | 1500ms (원본과 동일) |
| 공통 | 서버 주소 / API 토큰, **연결 테스트** | `.env.local` 값 |
| iPad | 처음 선택된 언어 | 日本語 |
| iPad | 마지막 방문자의 언어 유지 | 켜짐 (원본 동작) |
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

### 데이터 흐름 (원본과 동일)

```
iPad  소원 그리기 완료      POST /api/current   currentdata ← {status: waiting}
iPhone                      waiting 감지 → "make a wish" NFC 안내 화면
(태그)                      POST /api/tag       waiting → nfctagged, nfc_id 기록
iPad                        nfctagged 감지 → POST /api/lock (그림 PNG)
                            → R2 에 그림 저장, lockeddata {status: locked, image_url} 추가, currentdata 정리
iPad  "Tap to Continue"     POST /api/current   currentdata ← {status: unlockwaiting}
iPhone                      "fulfill someone's wish" 안내 화면
(태그)                      POST /api/tag       unlockwaiting → unlocknfctagged, nfc_id 기록
iPad                        unlocknfctagged 감지 → POST /api/unlock
                            → nfc_id 로 lockeddata 조회 → unlockeddata {status: unlocked} 추가, 정리
iPad  감사 화면             DELETE /api/current currentdata 전체 정리
```

**누가 `nfctagged` 로 바꾸나요?** 원본 iPhone 앱에는 NFC 읽기 코드가 없어서 외부(예: iOS 단축어 NFC 자동화)가 처리했던 것으로 보입니다.
- 단축어를 쓰려면 설정의 *앱에서 NFC 태그 직접 읽기* 를 **끈 채로** 두고, 단축어가 `POST /api/tag` 를 호출하게 하세요 ([서버 README](../MakeAWishServer/README.md#단축어로-태그-처리하기-앱의-nfc-직접-읽기를-끈-경우)).
- 켜면 iPhone 앱이 NFC 안내 화면에서 직접 태그 UID 를 읽어(`nfc_id` = UID 16진수 대문자) 상태를 바꿉니다. (NTAG/MIFARE Ultralight, ISO15693 태그 지원 · 개발 빌드 필요)

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
  i18n/strings.ts               원본 4개 언어 문구 (ja / en / ko / zh)
  fonts.ts                      언어별 폰트 (원본 FontManager)
  services/api.ts               Make a Wish 서버(Cloudflare Worker) 클라이언트
  services/wishFlow.ts          단계별 서버 호출 (원본 각 View 의 네트워크 코드)
  services/nfc.ts               NFC 태그 UID 읽기 (선택)
  components/DrawingCanvas.tsx  PencilKit 대체 드로잉 캔버스 (Skia)
  modes/iphone/IPhoneGuide.tsx  iPhone 가이드
  modes/ipad/IPadGuide.tsx      iPad 가이드 흐름 + screens/ 9개 화면
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

## 7. 개발 명령

```bash
npm run typecheck     # tsc
npm run lint          # eslint
npx expo-doctor       # 의존성/설정 점검
```

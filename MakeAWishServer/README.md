# Make a Wish 서버 (Cloudflare Workers)

iPhone·iPad 가이드 앱([`../MakeAWishGuide`](../MakeAWishGuide))이 함께 쓰는 서버입니다.

| 구성 | 역할 |
| --- | --- |
| **Worker** (`src/index.ts`) | API. 상태 전환과 테이블 이관을 트랜잭션으로 처리 |
| **D1** `make-a-wish-db` | `currentdata` / `lockeddata` / `unlockeddata` 테이블 (첫 요청 때 자동 생성) |
| **R2** `make-a-wish-drawings` | 소원 그림 PNG |
| **Durable Object** `WishHub` | 기기들의 WebSocket 연결을 유지하다가 상태가 바뀌면 바로 알려 줌 (기기가 계속 물어보지 않아도 됨) |
| **Secret** `API_TOKEN` | 앱과 공유하는 접근 토큰 |

## 배포 (Windows 에서 그대로 가능)

Node.js **24.22 이상** (또는 22.23 이상)이 필요합니다.

```bash
cd MakeAWishServer
npm install
npx cf auth login                 # 브라우저에서 Cloudflare 로그인

copy .secrets.env.example .secrets.env
#   .secrets.env 의 API_TOKEN 을 길고 임의의 문자열로 바꾸기
npm run deploy:secrets            # 처음 배포 + 토큰 등록 (D1·R2 는 자동 생성)
```

배포가 끝나면 `https://make-a-wish-server.<계정>.workers.dev` 형태의 주소가 출력됩니다.
그 주소와 API_TOKEN 을 앱의 설정 화면 → **서버** 에 넣고 **연결 테스트**를 누르세요.

- 코드만 바뀌었을 때: `npm run deploy`
- 토큰을 바꿀 때: `.secrets.env` 수정 후 `npm run deploy:secrets` → 모든 기기의 앱 설정도 같이 변경
- 실시간 로그: `npx wrangler tail make-a-wish-server`

## 로컬 개발

```bash
copy .dev.vars.example .dev.vars  # API_TOKEN=dev-token
npm run dev                        # http://localhost:5173
npm run typecheck
```

## API

`/api/*` 는 `Authorization: Bearer <API_TOKEN>` 헤더가 필요합니다.

| 요청 | 하는 일 | 호출하는 곳 |
| --- | --- | --- |
| `GET /api/live` (WebSocket) | 연결 즉시, 그리고 currentdata 가 바뀔 때마다 `{"type":"current","rows":[…]}` 전송. `ping` → `pong` | iPhone·iPad (기본) |
| `GET /api/current` | currentdata 행 목록 (최신순) | 실시간 연결이 안 될 때의 폴링, 2분마다 확인, 연결 테스트 |
| `POST /api/current` `{"status":"waiting"}` | waiting / unlockwaiting 추가 | iPad (소원 완료 / Tap to Continue) |
| `POST /api/tag` `{"nfcId":"04A1B2C3"}` | 가장 최근 waiting → nfctagged, unlockwaiting → unlocknfctagged | iPhone 앱(NFC 직접 읽기) 또는 단축어 |
| `POST /api/lock` (본문: PNG) | nfctagged 행 + 그림 → lockeddata, currentdata 정리 | iPad (종이 태그 감지 후) |
| `POST /api/unlock` | unlocknfctagged 의 nfc_id 로 lockeddata → unlockeddata | iPad (풀기 태그 감지 후) |
| `DELETE /api/current` | currentdata 전체 비우기 | iPad 감사 화면, 관리 메뉴 |
| `GET /images/<uuid>.png` | 그림 이미지 (인증 없음) | lockeddata.image_url |

### 단축어로 태그 처리하기 (앱의 NFC 직접 읽기를 끈 경우)

1. **공통 단축어 하나** (`Make a Wish 태그`): 동작 **URL 콘텐츠 가져오기**
   - URL: `https://make-a-wish-server.<계정>.workers.dev/api/tag`
   - 방법: `POST`, 헤더: `Authorization` = `Bearer <API_TOKEN>`
   - 요청 본문: JSON, `nfcId` = **단축어 입력**
2. **종이 태그마다 자동화** (단축어 → 자동화 → NFC → 태그 스캔, *즉시 실행*):
   동작 **텍스트** (`paper1` 처럼 종이마다 다른 값) → **단축어 실행** (`Make a Wish 태그`, 입력 = 텍스트)

같은 종이는 묶을 때와 풀 때 같은 `nfcId` 를 보내므로, 풀 때 그 종이에 묶였던 소원을 찾아 옮깁니다.
주소·토큰이 바뀌면 공통 단축어 하나만 고치면 됩니다.

PC 에서 테스트:

```powershell
Invoke-RestMethod -Method Post -Uri https://make-a-wish-server.<계정>.workers.dev/api/tag `
  -Headers @{ Authorization = "Bearer <API_TOKEN>" } -ContentType 'application/json' -Body '{"nfcId":"paper1"}'
```

## 사용량 (무료 플랜 기준 추정)

기기는 WebSocket 하나로 변화를 기다리므로, 1.5초마다 묻던 원본 방식(기기당 하루 최대 약 5만 8천 건)과 달리
기기당 하루 요청이 **수천 건 이하**입니다 (keep-alive ping 45초마다, 확인 요청 2분마다, 그 외엔 실제 변화가 있을 때만).
연결이 쉬는 동안 Durable Object 는 hibernation 상태라 사용 시간이 과금되지 않고, 서버가 보내는 메시지는 무료입니다.
무료 한도를 넘더라도 요금이 아니라 오류가 나며, 매일 09:00(KST) 에 초기화됩니다.

## 데이터 확인

Cloudflare 대시보드 → **Storage & databases → D1 → make-a-wish-db → Console** 에서
`SELECT * FROM lockeddata ORDER BY created_at DESC;` 처럼 바로 조회할 수 있습니다.

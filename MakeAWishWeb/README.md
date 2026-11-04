# Make a Wish 프로젝터 웹

풀린(unlockeddata) 소원 그림을 프로젝터로 띄우는 웹입니다. 데이터는 [`../MakeAWishServer`](../MakeAWishServer) (Cloudflare Worker) 에서 받습니다.

| 주소 | 화면 |
| --- | --- |
| `/` | 프로젝터 화면. 최신 그림이 frame-1, 그 다음이 frame-2 … 최대 20개. 새로 풀린 소원은 WebSocket 으로 바로 나타남. 마우스를 올리면 **X** 로 내리기 (DB 행만 삭제, 그림 파일은 서버에 남음) |
| `/setting` (또는 `#/setting`) | 프레임 20개를 드래그·리사이즈해서 배치. 0.4초 뒤 자동 저장되고 열려 있는 프로젝터 화면에 바로 반영. **clear**: currentdata 비우기 + lockeddata 의 같은 nfc_id 중복 정리 (가장 오래된 것만 남김) |

## 실행

```bash
cd MakeAWishWeb
npm install
cp .env.example .env     # (선택) 서버 주소 기본값 VITE_SERVER_URL
npm run dev              # http://localhost:5173 , 설정은 http://localhost:5173/setting
```

처음 열면 **서버 주소**와 **API 토큰**을 묻는 화면이 나옵니다 (가이드 앱 설정 → 서버 에 넣은 값과 동일).
토큰은 빌드 결과에 들어가지 않고 그 브라우저의 localStorage 에만 저장됩니다.
서버의 토큰을 바꾸면 다음 요청에서 401 이 나고 자동으로 입력 화면으로 돌아갑니다.

## 배포 (Cloudflare)

`https://make-a-wish-display.<계정>.workers.dev` 에 정적 사이트(Worker assets, SPA)로 올라가 있습니다.

```bash
npx cf auth login   # 처음 한 번
npm run deploy      # 빌드 + 업로드 (서버와 같은 cf 도구, 설정은 cloudflare.config.ts)
```

`.env` 의 `VITE_SERVER_URL` 이 빌드할 때 연결 화면의 기본 주소로 들어갑니다 (비밀값 아님).

# Make a Wish 프로젝터 웹

풀린(unlockeddata) 소원 그림을 프로젝터로 띄우는 웹입니다. 데이터는 [`../MakeAWishServer`](../MakeAWishServer) (Cloudflare Worker) 에서 받습니다.

| 주소 | 화면 |
| --- | --- |
| `/` | 프로젝터 화면. 에마 사진(`public/ema-wall.jpg`) 위의 나무판 16개에 풀린 소원 그림을 올림. 가장 최근 소원이 가운데 판부터 바깥쪽으로 (17번째 이후 소원은 표시 안 함). 새로 풀린 소원은 WebSocket 으로 바로 나타남. 마우스를 올리면 **X** 로 내리기 (DB 행만 삭제, 그림 파일은 서버에 남음) |
| `/setting` (또는 `#/setting`) | 에마 사진 위에서 소원 자리 16개(번호 = 채워지는 순서)를 드래그·리사이즈로 미세 조정. 0.4초 뒤 자동 저장되고 열려 있는 프로젝터 화면에 바로 반영. **에마 위치로 되돌리기**: 사진에서 측정한 나무판 위치로. **clear**: currentdata 비우기 + lockeddata 의 같은 nfc_id 중복 정리 (가장 오래된 것만 남김) |

### 풀린 소원 애니메이션

소원이 풀리면(unlockeddata 에 새 행) 화면이 살짝 어두워지며 그 소원이 **화면 중앙에 크게** 나타나고
(「誰かの願いがほどかれました / A wish has been released」), 약 4초 뒤 자기 나무판으로 작아지며 내려앉습니다 (`src/ReleaseReveal.tsx`).

- 화면을 처음 열 때 이미 있던 소원은 애니메이션하지 않음. 여러 개가 한꺼번에 풀리면 오래된 것부터 하나씩
- 키보드 **R**: 가장 최근 소원을 다시 재생 (설치·테스트 확인용)

### 에마 배치

- 좌표는 모두 배경 사진(1672×941) 픽셀 기준이라, 화면 크기와 상관없이 사진과 함께 확대·축소되어 같은 판 위에 놓입니다
- 나무판 위치·채우는 순서: `src/emaLayout.ts` (사진에서 밝은 판 영역을 찾아 측정)
- 서버에는 frame-21 ~ frame-36 으로 저장 (예전 4열 격자 배치 frame-1 ~ 20 은 사용하지 않음)
- 소원 그림의 흰 바탕은 나무결에 섞이게(multiply) 표시되어 판에 직접 쓴 것처럼 보입니다
- 배경 사진을 바꾸면 `emaLayout.ts` 의 STAGE 크기와 판 좌표도 함께 바꿔야 합니다

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

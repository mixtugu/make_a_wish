import type { FrameLayout } from './api';

/**
 * 에마(나무판) 사진 배경과 소원을 올릴 위치.
 *
 * 모든 좌표는 배경 사진(public/ema-wall.jpg, 1672×941)의 픽셀 기준입니다.
 * 화면 크기가 달라도 사진과 소원이 함께 확대·축소되므로 항상 같은 판 위에 놓입니다.
 * 위치는 사진에서 밝은 나무판 영역을 찾아 측정한 값이며, /setting 에서 끌어서 미세 조정할 수 있습니다.
 */
export const STAGE = { width: 1672, height: 941 } as const;

export const EMA_BACKGROUND = `${import.meta.env.BASE_URL}ema-wall.jpg`;

/** 사진 속 나무판 16개 (위→아래, 왼쪽→오른쪽 번호) */
const BOARDS: Record<number, { x: number; y: number; w: number; h: number }> = {
  1: { x: 181, y: 206, w: 201, h: 95 },
  2: { x: 487, y: 223, w: 277, h: 111 },
  3: { x: 1033, y: 215, w: 179, h: 97 },
  4: { x: 1381, y: 236, w: 180, h: 106 },
  5: { x: 804, y: 322, w: 187, h: 97 },
  6: { x: 1143, y: 332, w: 188, h: 103 },
  7: { x: 259, y: 355, w: 199, h: 114 },
  8: { x: 418, y: 453, w: 154, h: 97 },
  9: { x: 938, y: 456, w: 255, h: 112 },
  10: { x: 582, y: 495, w: 171, h: 97 },
  11: { x: 1314, y: 449, w: 212, h: 104 },
  12: { x: 295, y: 555, w: 166, h: 102 },
  13: { x: 1123, y: 575, w: 141, h: 84 },
  14: { x: 768, y: 580, w: 178, h: 101 },
  15: { x: 488, y: 607, w: 235, h: 104 },
  16: { x: 873, y: 674, w: 242, h: 107 },
};

/** 새 소원부터 채우는 순서: 가운데 판부터 바깥쪽으로 */
const FILL_ORDER = [5, 9, 16, 2, 14, 15, 10, 6, 7, 3, 11, 1, 12, 8, 13, 4];

export const EMA_COUNT = FILL_ORDER.length;

/**
 * 서버에 저장할 때의 프레임 id. 예전 4열 격자 배치(frame-1~20)와 섞이지 않도록 frame-21 부터 사용
 * (n번째로 새로운 소원 → frame-(20+n))
 */
const ID_OFFSET = 20;
export const emaFrameId = (slot: number) => `frame-${ID_OFFSET + slot}`;

/** 사진에 맞춘 기본 배치 (slot 1 = 가장 최근 소원) */
export function emaPreset(): FrameLayout[] {
  return FILL_ORDER.map((board, i) => ({ id: emaFrameId(i + 1), ...BOARDS[board] }));
}

/** 서버에 저장된 미세 조정 값이 있으면 그것을, 없으면 기본 배치를 사용 */
export function resolveEmaFrames(saved: FrameLayout[]): FrameLayout[] {
  const byId = new Map(saved.map((f) => [f.id, f]));
  return emaPreset().map((p) => byId.get(p.id) ?? p);
}

/** 소원 그림을 판 가장자리에서 띄우는 여백 (판 크기 대비) */
export const WISH_INSET = { x: 0.08, y: 0.1 };

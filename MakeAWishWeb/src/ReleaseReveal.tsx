import { useEffect, useState } from 'react';

import type { FrameLayout, UnlockedRow } from './api';
import { STAGE, WISH_INSET } from './emaLayout';

/**
 * 풀린 소원 애니메이션 (플로차트: シンプルなアニメーション / 解放された願いが画面の中央に現れる)
 *
 *  1) 화면이 살짝 어두워지며 소원이 화면 중앙에 크게 나타남 (페이드 + 확대)
 *  2) 잠시 머문 뒤
 *  3) 자기 자리(나무판)로 작아지며 이동하고, 판의 나무결에 섞여 자연스럽게 내려앉음
 *
 * 좌표는 에마 사진(STAGE) 기준이라 화면 크기와 상관없이 같은 판으로 날아갑니다.
 */
const CENTER = { w: 720, h: 340 };
const CENTER_BOX = {
  x: (STAGE.width - CENTER.w) / 2,
  y: (STAGE.height - CENTER.h) / 2 - 30,
  w: CENTER.w,
  h: CENTER.h,
};

const APPEAR_MS = 900;
const HOLD_MS = 3800;
const SETTLE_MS = 1200;

type Phase = 'start' | 'show' | 'settle';

export function ReleaseReveal({
  row,
  target,
  onDone,
}: {
  row: UnlockedRow;
  /** 소원이 내려앉을 판. 없으면(표시 범위 밖) 가운데에서 사라짐 */
  target: FrameLayout | undefined;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('start');

  useEffect(() => {
    // 첫 프레임을 그린 뒤 단계 전환 → CSS transition 이 동작
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('show')));
    const t1 = setTimeout(() => setPhase('settle'), APPEAR_MS + HOLD_MS);
    const t2 = setTimeout(onDone, APPEAR_MS + HOLD_MS + SETTLE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // onDone 은 소원마다 한 번만 쓰이므로 다시 시작하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settling = phase === 'settle';
  const box = settling && target ? target : CENTER_BOX;
  const ease = settling ? `${SETTLE_MS}ms cubic-bezier(0.55, 0, 0.25, 1)` : `${APPEAR_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

  return (
    <>
      {/* 배경을 살짝 어둡게 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10,6,3,0.5)',
          opacity: phase === 'show' ? 1 : 0,
          transition: `opacity ${ease}`,
          pointerEvents: 'none',
        }}
      />
      {/* 소원 카드: 가운데에서 크게 → 자기 판으로 */}
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          opacity: phase === 'start' || (settling && !target) ? 0 : 1,
          transform: phase === 'start' ? 'scale(0.82)' : 'scale(1)',
          // 밝은 나무색 카드. 내려앉을 때는 사진 속 판과 비슷한 색으로 바뀌어 자연스럽게 겹침
          // (그림의 흰 바탕은 이 카드 색과 섞이므로 카드를 투명하게 하면 흰 사각형이 드러남)
          background: settling ? '#e6d5c2' : 'linear-gradient(180deg, #f3e8da 0%, #e9dac6 100%)',
          boxShadow: settling ? '0 0 0 rgba(0,0,0,0)' : '0 24px 60px rgba(0,0,0,0.45)',
          borderRadius: settling ? 2 : 6,
          transition: ['left', 'top', 'width', 'height', 'opacity', 'transform', 'background', 'box-shadow', 'border-radius']
            .map((p) => `${p} ${ease}`)
            .join(', '),
          pointerEvents: 'none',
        }}
      >
        <img
          src={row.image_url ?? ''}
          alt="released wish"
          draggable={false}
          style={{
            position: 'absolute',
            left: `${WISH_INSET.x * 100}%`,
            top: `${WISH_INSET.y * 100}%`,
            width: `${(1 - 2 * WISH_INSET.x) * 100}%`,
            height: `${(1 - 2 * WISH_INSET.y) * 100}%`,
            objectFit: 'contain',
            mixBlendMode: 'multiply',
          }}
        />
      </div>
      {/* 안내 문구 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: CENTER_BOX.y + CENTER_BOX.h + 28,
          textAlign: 'center',
          color: '#fff8ee',
          fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
          letterSpacing: '0.2em',
          opacity: phase === 'show' ? 1 : 0,
          transform: phase === 'show' ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity ${ease}, transform ${ease}`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 26 }}>誰かの願いがほどかれました</div>
        <div style={{ fontSize: 15, marginTop: 8, opacity: 0.8 }}>A wish has been released</div>
      </div>
    </>
  );
}

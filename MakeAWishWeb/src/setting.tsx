import { useEffect, useRef, useState } from 'react';
import { api, type FrameLayout } from './api';

/**
 * /setting 페이지
 * - 20개의 프레임을 자유 배치(드래그) + 리사이즈 가능
 * - 각 프레임의 (x,y,w,h)를 서버(D1 setting_layouts)에 저장/복원
 *   저장된 배치가 없으면 프로젝터 화면의 기본 배치(4열 그리드)로 20개를 채움
 * - 배경/프레임은 모두 흰색, 평소엔 테두리 없음, 호버 시 연한 회색 테두리
 */

const FRAME_COUNT = 20;

// 프로젝터 화면(App.tsx)의 기본 배치와 같은 그리드
function defaultViews(): Record<string, { x: number; y: number; w: number; h: number }> {
  const baseW = 320, baseH = 220, margin = 16, cols = 4;
  const map: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (let i = 0; i < FRAME_COUNT; i++) {
    const col = i % cols; const r = Math.floor(i / cols);
    map[`frame-${i + 1}`] = { x: col * (baseW + margin), y: r * (baseH + margin), w: baseW, h: baseH };
  }
  return map;
}

export default function SettingPage() {
  const [views, setViews] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number; // 프레임 내에서 클릭 지점 x 오프셋
    offsetY: number; // 프레임 내에서 클릭 지점 y 오프셋
    canvasLeft: number; // 캔버스 화면상의 좌표 기준 (getBoundingClientRect)
    canvasTop: number;
    scrollLeft: number; // 캔버스 스크롤 보정
    scrollTop: number;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [topId, setTopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resizeObservers = useRef<Record<string, ResizeObserver>>({});

  // 1) 서버에서 기존 레이아웃 로드 → views 초기화
  useEffect(() => {
    (async () => {
      try {
        const data = await api.listLayouts();
        const map = defaultViews(); // 저장 안 된 프레임은 기본 배치
        for (const it of data) {
          map[it.id] = { x: it.x, y: it.y, w: it.w, h: it.h };
        }
        setViews(map);
      } catch (e: any) {
        console.error('[layouts load] error:', e);
        setStatusMsg(`[로드 실패] ${e?.message ?? e}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 2) views 변화 디바운스 저장 (서버 upsert → 프로젝터 화면에 바로 반영)
  useEffect(() => {
    if (isLoading) return; // 로드 전 빈 값을 저장하지 않음
    const timer = setTimeout(async () => {
      try {
        const entries = Object.entries(views);
        if (entries.length === 0) return; // 저장할 항목 없음
        const payload: FrameLayout[] = entries.map(([id, v]) => ({
          id,
          x: Math.round(v.x),
          y: Math.round(v.y),
          w: Math.round(v.w),
          h: Math.round(v.h),
        }));
        await api.saveLayouts(payload);
      } catch (e: any) {
        console.error('[layouts save] error:', e);
        setStatusMsg(`[저장 실패] ${e?.message ?? e}`);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [views, isLoading]);

  // 3) 전역 마우스 핸들러 (드래그 이동)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const { id, offsetX, offsetY, canvasLeft, canvasTop, scrollLeft, scrollTop } = dragging;
      setViews((prev) => {
        const cur = prev[id] ?? { x: 0, y: 0, w: 260, h: 180 };
        const nextX = e.clientX - canvasLeft + scrollLeft - offsetX;
        const nextY = e.clientY - canvasTop + scrollTop - offsetY;
        if (Math.round(cur.x) === Math.round(nextX) && Math.round(cur.y) === Math.round(nextY)) return prev;
        return { ...prev, [id]: { ...cur, x: nextX, y: nextY } };
      });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  // 4) 리사이즈 감지: 각 프레임에 ResizeObserver 부착하여 w/h 반영
  const setItemRef = (id: string, el: HTMLDivElement | null) => {
    if (resizeObservers.current[id]) {
      try { resizeObservers.current[id].disconnect(); } catch {}
      delete resizeObservers.current[id];
    }
    itemRefs.current[id] = el;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setViews((prev) => {
        const cur = prev[id] ?? { x: 0, y: 0, w: rect.width, h: rect.height };
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (Math.round(cur.w) === w && Math.round(cur.h) === h) return prev;
        return { ...prev, [id]: { ...cur, w, h } };
      });
    });
    ro.observe(el);
    resizeObservers.current[id] = ro;
  };

  // 언마운트 시 옵저버 정리
  useEffect(() => {
    return () => {
      Object.values(resizeObservers.current).forEach((ro) => {
        try { ro.disconnect(); } catch {}
      });
      resizeObservers.current = {};
      itemRefs.current = {};
    };
  }, []);

  // ===== Cleanup handler: currentdata 전체 삭제 + lockeddata 중복(nfc_id)에서 최신(더 새로운) 행 삭제 =====
  // 서버(POST /api/cleanup)가 한 번에 트랜잭션으로 처리
  const handleCleanup = async () => {
    try {
      setStatusMsg('정리 중...');
      const { current, locked } = await api.cleanup();
      setStatusMsg(`정리 완료: currentdata ${current}건 삭제, lockeddata ${locked}건 삭제`);
    } catch (e: any) {
      console.error(e);
      setStatusMsg(`[정리 실패] ${e?.message ?? e}`);
    }
  };

  // 렌더
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff' }}>
      {/* 절대(고정) 위치 정리 버튼: 다른 요소 레이아웃에 영향 없음 */}
      <button
        type="button"
        onClick={handleCleanup}
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2000,
          padding: '6px 10px',
          fontSize: 12,
          color: '#fff',
          background: '#ef4444',
          border: 'none',
          borderRadius: 6,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          cursor: 'pointer',
        }}
        title="currentdata 전체 삭제 / lockeddata 중복 최신 삭제"
      >
        clear
      </button>
      {statusMsg && (
        <div style={{ position: 'absolute', top: 48, left: 8, padding: '6px 8px', fontSize: 12, background: 'rgba(248,250,252,0.95)', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a' }}>
          {statusMsg}
        </div>
      )}
      <div
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#ffffff' }}
      >
        {isLoading ? null : (Object.keys(views).length === 0 && (
          <div style={{ position: 'absolute', top: 24, left: 24, color: '#64748b', fontSize: 13 }}>
            프레임 배치가 없습니다.
          </div>
        ))}
        <div style={{ position: 'relative', minWidth: 1200, minHeight: 800 }}>
          {Object.entries(views).map(([id, v]) => (
            <div
              key={id}
              ref={(el) => setItemRef(id, el)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered((prev) => (prev === id ? null : prev))}
              onMouseDown={(e) => {
                setTopId(id);
                if (e.button !== 0) return;
                const el = canvasRef.current;
                if (!el) return;
                const parentRect = el.getBoundingClientRect();
                const cardEl = e.currentTarget as HTMLDivElement;
                const cardRect = cardEl.getBoundingClientRect();
                const gripThreshold = 18;
                const nearRight = cardRect.right - e.clientX <= gripThreshold;
                const nearBottom = cardRect.bottom - e.clientY <= gripThreshold;
                const isResizeGrip = nearRight && nearBottom;
                if (isResizeGrip) return;
                setDragging({
                  id,
                  offsetX: e.clientX - cardRect.left,
                  offsetY: e.clientY - cardRect.top,
                  canvasLeft: parentRect.left,
                  canvasTop: parentRect.top,
                  scrollLeft: el.scrollLeft,
                  scrollTop: el.scrollTop,
                });
              }}
              title={`${id}`}
              style={{
                position: 'absolute',
                left: Number(v.x),
                top: Number(v.y),
                width: Number(v.w),
                height: Number(v.h),
                border: hovered === id ? '1px solid #64748b' : '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#ffffff',
                boxShadow: '0 0 0 rgba(0,0,0,0)',
                overflow: 'hidden',
                resize: 'both',
                cursor: hovered === id ? (dragging?.id === id ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
                zIndex: topId === id ? 1000 : 1,
              }}
            >
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                {id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

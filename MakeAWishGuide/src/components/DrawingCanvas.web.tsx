import { useCallback, useEffect, useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react';

/**
 * 브라우저 테스트용 그리기 캔버스 (HTML canvas + Pointer Events).
 * iPhone/iPad 앱은 DrawingCanvas.tsx (Skia) 를 쓰고, 브라우저에서만 이 파일이 쓰입니다.
 * 외부 동작(획, 지우개, 되돌리기, PNG 내보내기)은 앱판과 같습니다.
 */
export type DrawingTool = 'pen' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: number;
  points: Point[];
  color: string;
  width: number;
}

export interface DrawingExport {
  /** PNG 바이트 (서버 업로드용) */
  bytes: Uint8Array;
  /** PNG base64 (화면 미리보기용) */
  base64: string;
  width: number;
  height: number;
}

export interface DrawingCanvasHandle {
  exportPng: () => DrawingExport | null;
  undo: () => void;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  width: number;
  height: number;
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  onActiveChange?: (active: boolean) => void;
  onChange?: (strokeCount: number) => void;
  ref?: Ref<DrawingCanvasHandle>;
}

const ERASER_RADIUS = 10;
const EXPORT_PADDING = 8;
const MAX_HISTORY = 50;
const MAX_PIXEL_RATIO = 2;
const EXPORT_PIXEL_RATIO = 3;

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function strokeHit(stroke: Stroke, p: Point): boolean {
  const limit = stroke.width / 2 + ERASER_RADIUS;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(p.x - pts[0].x, p.y - pts[0].y) <= limit;
  for (let i = 1; i < pts.length; i++) {
    if (distanceToSegment(p, pts[i - 1], pts[i]) <= limit) return true;
  }
  return false;
}

function applyPen(ctx: CanvasRenderingContext2D, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** 중점 2차 곡선 보간 (앱판 Skia 경로와 같은 모양) */
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  applyPen(ctx, s.color, s.width);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) {
    ctx.lineTo(pts[0].x + 0.1, pts[0].y);
  } else {
    for (let i = 1; i < pts.length; i++) {
      const m = mid(pts[i - 1], pts[i]);
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, m.x, m.y);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

export function DrawingCanvas({ width, height, tool, color, strokeWidth, onActiveChange, onChange, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const historyRef = useRef<Stroke[][]>([]);
  const nextId = useRef(1);
  const active = useRef<Stroke | null>(null);
  const pointerId = useRef<number | null>(null);
  const erasedThisGesture = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    redraw();
  }, [width, height, redraw]);

  const commit = useCallback(
    (next: Stroke[], pushHistory: boolean) => {
      if (pushHistory) {
        historyRef.current.push(strokesRef.current);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      }
      strokesRef.current = next;
      redraw();
      onChange?.(next.length);
    },
    [onChange, redraw],
  );

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * width) / (rect.width || width),
      y: ((e.clientY - rect.top) * height) / (rect.height || height),
    };
  };

  const eraseAt = (p: Point) => {
    const remaining = strokesRef.current.filter((s) => !strokeHit(s, p));
    if (remaining.length !== strokesRef.current.length) {
      commit(remaining, !erasedThisGesture.current);
      erasedThisGesture.current = true;
    }
  };

  /** 그리는 중인 획의 마지막 구간만 덧그림 */
  const extend = (s: Stroke, p: Point) => {
    const pts = s.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1) return;
    pts.push(p);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const from = pts.length >= 3 ? mid(pts[pts.length - 3], last) : last;
    const to = mid(last, p);
    applyPen(ctx, s.color, s.width);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(last.x, last.y, to.x, to.y);
    ctx.stroke();
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointerId.current !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    onActiveChange?.(true);
    const p = toPoint(e);
    if (tool === 'eraser') {
      erasedThisGesture.current = false;
      eraseAt(p);
    } else {
      const s: Stroke = { id: nextId.current++, points: [p], color, width: strokeWidth };
      active.current = s;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawStroke(ctx, s);
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== pointerId.current) return;
    e.preventDefault();
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toPoint(ev);
      if (tool === 'eraser') eraseAt(p);
      else if (active.current) extend(active.current, p);
    }
  };

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    onActiveChange?.(false);
    const s = active.current;
    active.current = null;
    if (s) commit([...strokesRef.current, s], true);
  };

  useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => strokesRef.current.length === 0,
      undo: () => {
        const prev = historyRef.current.pop();
        if (prev) commit(prev, false);
      },
      clear: () => {
        if (strokesRef.current.length) commit([], true);
      },
      exportPng: () => {
        const list = strokesRef.current;
        let x = 0;
        let y = 0;
        let w = width;
        let h = height;
        if (list.length) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const s of list) {
            const half = s.width / 2;
            for (const p of s.points) {
              minX = Math.min(minX, p.x - half);
              minY = Math.min(minY, p.y - half);
              maxX = Math.max(maxX, p.x + half);
              maxY = Math.max(maxY, p.y + half);
            }
          }
          x = Math.floor(minX - EXPORT_PADDING);
          y = Math.floor(minY - EXPORT_PADDING);
          w = Math.ceil(maxX + EXPORT_PADDING) - x;
          h = Math.ceil(maxY + EXPORT_PADDING) - y;
        }
        const scale = Math.min(window.devicePixelRatio || 1, EXPORT_PIXEL_RATIO);
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.ceil(w * scale));
        out.height = Math.max(1, Math.ceil(h * scale));
        const ctx = out.getContext('2d');
        if (!ctx) return null;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
        for (const s of list) drawStroke(ctx, s);
        const dataUrl = out.toDataURL('image/png');
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { bytes, base64, width: w, height: h };
      },
    }),
    [commit, width, height],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block', touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

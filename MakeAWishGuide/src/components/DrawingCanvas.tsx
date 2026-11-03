import {
  Canvas,
  ImageFormat,
  PaintStyle,
  Path,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkPath,
  type SkPathBuilder,
} from '@shopify/react-native-skia';
import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { PixelRatio, View, type GestureResponderEvent } from 'react-native';

export type DrawingTool = 'pen' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: number;
  points: Point[];
  path: SkPath;
  color: string;
  width: number;
}

export interface DrawingExport {
  /** PNG 바이트 (Storage 업로드용) */
  bytes: Uint8Array;
  /** PNG base64 (화면 미리보기용) */
  base64: string;
  /** pt 단위 크기 */
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
  /** 그리는 동안 상위 ScrollView 스크롤을 막기 위해 사용 */
  onActiveChange?: (active: boolean) => void;
  onChange?: (strokeCount: number) => void;
  ref?: Ref<DrawingCanvasHandle>;
}

const ERASER_RADIUS = 10;
const EXPORT_PADDING = 8; // 원본: bounds.insetBy(dx: -8, dy: -8)
const MAX_HISTORY = 50;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
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

/** 현재 그리고 있는 획 (렌더링과 무관한 가변 상태라 ref 에 보관) */
interface ActiveStroke {
  builder: SkPathBuilder;
  points: Point[];
  color: string;
  width: number;
}

/**
 * 원본 PencilCanvasView(PKCanvasView) 대체.
 * - 손가락 / Apple Pencil 모두 입력 가능 (drawingPolicy = .anyInput)
 * - 지우개는 PencilKit 의 .vector 지우개처럼 닿은 획 전체를 지움
 */
export function DrawingCanvas({
  width,
  height,
  tool,
  color,
  strokeWidth,
  onActiveChange,
  onChange,
  ref,
}: Props) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<{ path: SkPath; color: string; width: number } | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const historyRef = useRef<Stroke[][]>([]);
  const nextId = useRef(1);
  const active = useRef<ActiveStroke | null>(null);
  // pageX → 캔버스 좌표 변환용 오프셋 (터치 시작 시 계산)
  const offset = useRef({ x: 0, y: 0 });
  const erasing = useRef(false);
  const erasedThisGesture = useRef(false);

  const commit = useCallback(
    (next: Stroke[], pushHistory: boolean) => {
      if (pushHistory) {
        historyRef.current.push(strokesRef.current);
        if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
      }
      strokesRef.current = next;
      setStrokes(next);
      onChange?.(next.length);
    },
    [onChange],
  );

  const toCanvas = (e: GestureResponderEvent): Point => ({
    x: e.nativeEvent.pageX + offset.current.x,
    y: e.nativeEvent.pageY + offset.current.y,
  });

  const eraseAt = (p: Point) => {
    const remaining = strokesRef.current.filter((s) => !strokeHit(s, p));
    if (remaining.length !== strokesRef.current.length) {
      commit(remaining, !erasedThisGesture.current);
      erasedThisGesture.current = true;
    }
  };

  // ── 터치 처리 (View responder) ──────────────────────────────
  const onGrant = (e: GestureResponderEvent): boolean => {
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    offset.current = { x: locationX - pageX, y: locationY - pageY };
    onActiveChange?.(true);
    const p = { x: locationX, y: locationY };

    if (tool === 'eraser') {
      erasing.current = true;
      erasedThisGesture.current = false;
      eraseAt(p);
    } else {
      erasing.current = false;
      const builder = Skia.PathBuilder.Make();
      builder.moveTo(p.x, p.y);
      active.current = { builder, points: [p], color, width: strokeWidth };
      setCurrent({ path: builder.build(), color, width: strokeWidth });
    }
    // true = 네이티브 응답자(ScrollView 등)가 터치를 가져가지 못하게 막음
    return true;
  };

  const onMove = (e: GestureResponderEvent) => {
    const p = toCanvas(e);
    if (erasing.current) {
      eraseAt(p);
      return;
    }
    const a = active.current;
    if (!a) return;
    const last = a.points[a.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1) return;
    // 중점 2차 곡선 보간으로 부드러운 선
    a.builder.quadTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
    a.points.push(p);
    const path = a.builder.build();
    setCurrent((c) => (c ? { ...c, path } : c));
  };

  const onEnd = () => {
    onActiveChange?.(false);
    erasing.current = false;
    const a = active.current;
    active.current = null;
    setCurrent(null);
    if (!a) return;
    const last = a.points[a.points.length - 1];
    if (a.points.length === 1) a.builder.lineTo(last.x + 0.1, last.y); // 점 찍기
    else a.builder.lineTo(last.x, last.y);
    const stroke: Stroke = {
      id: nextId.current++,
      points: a.points,
      path: a.builder.build(),
      color: a.color,
      width: a.width,
    };
    commit([...strokesRef.current, stroke], true);
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
        // 그림 영역 계산 (없으면 캔버스 전체 – 원본 fallback 동작)
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
            const r = s.path.computeTightBounds();
            const half = s.width / 2;
            minX = Math.min(minX, r.x - half);
            minY = Math.min(minY, r.y - half);
            maxX = Math.max(maxX, r.x + r.width + half);
            maxY = Math.max(maxY, r.y + r.height + half);
          }
          x = Math.floor(minX - EXPORT_PADDING);
          y = Math.floor(minY - EXPORT_PADDING);
          w = Math.ceil(maxX + EXPORT_PADDING) - x;
          h = Math.ceil(maxY + EXPORT_PADDING) - y;
        }
        const scale = Math.min(PixelRatio.get(), 3);
        const pw = Math.max(1, Math.ceil(w * scale));
        const ph = Math.max(1, Math.ceil(h * scale));
        const surface = Skia.Surface.Make(pw, ph) ?? Skia.Surface.MakeOffscreen(pw, ph);
        if (!surface) return null;
        const canvas = surface.getCanvas();
        canvas.drawColor(Skia.Color('white'));
        canvas.scale(scale, scale);
        canvas.translate(-x, -y);
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeCap(StrokeCap.Round);
        paint.setStrokeJoin(StrokeJoin.Round);
        for (const s of list) {
          paint.setColor(Skia.Color(s.color));
          paint.setStrokeWidth(s.width);
          canvas.drawPath(s.path, paint);
        }
        surface.flush();
        const image = surface.makeImageSnapshot();
        return {
          bytes: image.encodeToBytes(ImageFormat.PNG, 100),
          base64: image.encodeToBase64(ImageFormat.PNG, 100),
          width: w,
          height: h,
        };
      },
    }),
    [commit, width, height],
  );

  return (
    <View
      style={{ width, height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}
    >
      <Canvas style={{ width, height }} pointerEvents="none">
        {strokes.map((s) => (
          <Path
            key={s.id}
            path={s.path}
            style="stroke"
            strokeWidth={s.width}
            strokeCap="round"
            strokeJoin="round"
            color={s.color}
          />
        ))}
        {current && (
          <Path
            path={current.path}
            style="stroke"
            strokeWidth={current.width}
            strokeCap="round"
            strokeJoin="round"
            color={current.color}
          />
        )}
      </Canvas>
    </View>
  );
}

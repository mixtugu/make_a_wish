import { useEffect, useRef, useState } from 'react';
import { api, useDisplayData, type UnlockedRow } from './api';
import './App.css';
import { EMA_BACKGROUND, resolveEmaFrames, STAGE, WISH_INSET } from './emaLayout';
import { ReleaseReveal } from './ReleaseReveal';

function App() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState<string>('');

  // 서버가 연결 즉시 + 바뀔 때마다 unlockeddata / 프레임 배치를 보내 줌 (WebSocket)
  const { rows, setRows, frames, loaded } = useDisplayData();
  const scale = useStageScale();
  const { current: revealing, done: revealDone } = useReleaseQueue(rows, loaded);

  // 이미지(스토리지) + DB 행 삭제 (상태 메시지 표시)
  const handleDelete = async (row: UnlockedRow) => {
    if (!row?.id) return;
    setDeleting((prev) => ({ ...prev, [row.id]: true }));
    try {
      setStatusMsg(`削除開始: id=${row.id}`);
      // DB 삭제 (unlockeddata)
      try {
        await api.deleteUnlocked(row.id);
      } catch (delErr: any) {
        setStatusMsg((m) => m + `\n[エラー] DB削除失敗: ${delErr?.message ?? delErr}`);
        alert(`DB削除に失敗しました:\n${delErr?.message ?? delErr}`);
        return;
      }
      setStatusMsg((m) => m + `\nDB削除成功`);
      // 로컬 상태 반영
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setStatusMsg((m) => m + `\n完了 ✅（サーバーの画像ファイルは残ります）`);
    } catch (e: any) {
      console.error(e);
      setStatusMsg((m) => m + `\n[例外] ${e?.message ?? e}`);
      alert('削除中に例外が発生しました。\nコンソールを確認してください。');
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  // 최신 소원이 1번 자리(가운데 판), 그 다음이 2번 … 에마 개수(16)까지. 그보다 오래된 소원은 표시하지 않음
  const desc = [...rows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta; // 최신 우선
  });
  const boards = resolveEmaFrames(frames);
  const placed = boards.map((box, i) => ({ box, slot: i + 1, row: desc[i] })).filter((p) => !!p.row);
  // 애니메이션 중인 소원이 내려앉을 판
  const revealTarget = revealing ? boards[desc.findIndex((r) => r.id === revealing.id)] : undefined;

  return (
    // 사진 비율을 유지한 채 화면에 꽉 차게 (남는 부분은 사진 톤의 어두운 색)
    <div style={{ position: 'fixed', inset: 0, background: '#16110d', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: STAGE.width,
          height: STAGE.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          backgroundImage: `url(${EMA_BACKGROUND})`,
          backgroundSize: '100% 100%',
        }}
      >
        {placed.map(({ box, slot, row }) => {
          const hoverKey = row!.id;
          const isHovered = hovered === hoverKey;
          return (
            <div
              key={box.id}
              title={row!.image_url ?? ''}
              style={{
                position: 'absolute',
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                outline: isHovered ? '2px solid rgba(255,255,255,0.7)' : 'none',
                cursor: 'default',
              }}
              onMouseEnter={() => setHovered(hoverKey)}
              onMouseLeave={() => setHovered((prev) => (prev === hoverKey ? null : prev))}
            >
              {/* 소원 그림: 흰 바탕이 나무결에 섞이도록 multiply → 판에 직접 쓴 것처럼 보임
                  (애니메이션 중인 소원은 내려앉을 때까지 비워 둠) */}
              {revealing?.id !== row!.id && <img
                src={row!.image_url ?? ''}
                alt={`wish-${slot}`}
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${WISH_INSET.x * 100}%`,
                  top: `${WISH_INSET.y * 100}%`,
                  width: `${(1 - 2 * WISH_INSET.x) * 100}%`,
                  height: `${(1 - 2 * WISH_INSET.y) * 100}%`,
                  objectFit: 'contain',
                  mixBlendMode: 'multiply',
                  pointerEvents: 'none',
                }}
              />}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    left: 4,
                    right: 4,
                    bottom: 4,
                    padding: '3px 6px',
                    fontSize: 10,
                    color: '#ffffff',
                    background: 'rgba(0,0,0,0.55)',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    pointerEvents: 'none',
                  }}
                >
                  {`新しい順 ${slot}番目の願い`}
                  {row!.created_at && ` · ${new Date(row!.created_at).toLocaleString()}`}
                </div>
              )}
              {isHovered && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); handleDelete(row!); }}
                  disabled={!!deleting[row!.id]}
                  style={{ position: 'absolute', top: 4, right: 4, padding: '3px 7px', fontSize: 11, borderRadius: 4, border: 'none', background: deleting[row!.id] ? '#94a3b8' : '#ef4444', color: '#ffffff', cursor: deleting[row!.id] ? 'not-allowed' : 'pointer' }}
                  title="この願いを画面から外します（DBの行のみ削除、画像ファイルはサーバーに残ります）"
                >
                  {deleting[row!.id] ? '…' : 'X'}
                </button>
              )}
            </div>
          );
        })}
        {revealing && (
          <ReleaseReveal key={revealing.id + ':' + revealing.created_at} row={revealing} target={revealTarget} onDone={revealDone} />
        )}
      </div>
      {statusMsg && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          padding: '6px 8px', fontSize: 12, color: '#0f172a',
          background: 'rgba(248,250,252,0.9)', border: '1px solid #e2e8f0', borderRadius: 6,
          maxWidth: 420, whiteSpace: 'pre-wrap'
        }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}

/**
 * 새로 풀린 소원을 차례로 하나씩 애니메이션.
 * - 화면을 처음 열 때 이미 있던 소원은 애니메이션하지 않음
 * - 여러 개가 한꺼번에 풀리면 오래된 것부터 순서대로
 * - 키보드 R: 가장 최근 소원을 다시 재생 (설치·테스트 확인용)
 */
function useReleaseQueue(rows: UnlockedRow[], loaded: boolean) {
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<UnlockedRow[]>([]);

  useEffect(() => {
    if (!loaded) return;
    if (!seen.current) {
      seen.current = new Set(rows.map((r) => r.id));
      return;
    }
    const known = seen.current;
    const fresh = rows
      .filter((r) => !known.has(r.id))
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
    if (!fresh.length) return;
    fresh.forEach((r) => known.add(r.id));
    setQueue((q) => [...q, ...fresh]);
  }, [rows, loaded]);

  const latest = useRef<UnlockedRow | undefined>(undefined);
  latest.current = [...rows].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )[0];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && latest.current) {
        const row = latest.current;
        setQueue((q) => [...q, row]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { current: queue[0], done: () => setQueue((q) => q.slice(1)) };
}

/** 화면에 사진 전체가 들어가도록 하는 배율 (창 크기가 바뀌면 다시 계산) */
function useStageScale(): number {
  const calc = () => Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height);
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = () => setScale(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

export default App;

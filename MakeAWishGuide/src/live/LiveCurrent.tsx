import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useApi } from '../hooks/useApi';
import type { CurrentRow } from '../services/api';
import { useSettings } from '../settings/SettingsContext';
import { log } from '../utils/log';

// 브라우저 테스트에서는 WebSocket 에 토큰 헤더를 붙일 수 없으므로 주기적 확인만 사용
const LIVE_SUPPORTED = Platform.OS !== 'web';

/**
 * 서버의 currentdata 를 앱 전체에서 하나의 연결로 지켜봅니다.
 *
 * - 기본: WebSocket(/api/live). 서버가 상태가 바뀔 때만 보내 주므로 1.5초마다 묻지 않아도 됨
 *   → 요청 수가 원본 폴링 대비 수십 분의 1 로 줄고, 반응도 즉시
 * - WebSocket 이 안 되거나 끊기면 자동으로 예전 방식(주기적 확인)으로 바꿨다가 다시 연결되면 복귀
 * - 앱이 백그라운드로 가면 연결과 확인을 모두 멈춤
 */
export type LiveTransport = 'live' | 'polling' | 'off';

interface LiveValue {
  rows: CurrentRow[] | null;
  transport: LiveTransport;
}

const LiveContext = createContext<LiveValue>({ rows: null, transport: 'off' });

/** 연결 유지용 ping 주기 (서버가 객체를 깨우지 않고 바로 pong 으로 응답) */
const PING_MS = 45_000;
const PONG_TIMEOUT_MS = 10_000;
/** 실시간 연결 중에도 혹시 놓친 알림이 있을까 봐 가끔 한 번 맞춰 봄 */
const RESYNC_MS = 120_000;
/** WebSocket 이 이 시간 안에 안 열리면 우선 폴링으로 시작 */
const FALLBACK_AFTER_MS = 3_000;
const MAX_BACKOFF_MS = 30_000;

type Timer = ReturnType<typeof setTimeout> | null;

// React Native 의 WebSocket 은 세 번째 인자로 헤더를 받을 수 있음 (웹 표준에는 없음)
type RNWebSocketCtor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers: Record<string, string> },
) => WebSocket;

export function LiveCurrentProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const api = useApi();
  const [rows, setRows] = useState<CurrentRow[] | null>(null);
  const [transport, setTransport] = useState<LiveTransport>('off');
  const { serverUrl, apiToken, pollIntervalMs, liveUpdates } = settings;

  useEffect(() => {
    if (!serverUrl) return;
    let cancelled = false;
    // 브라우저 테스트에서는 창이 가려져도(다른 탭) 계속 확인 – 두 화면을 탭으로 띄워도 동작하도록
    let active = Platform.OS === 'web' || AppState.currentState !== 'background';
    let ws: WebSocket | null = null;
    let wsOpen = false;
    let attempt = 0;
    let pollTimer: Timer = null;
    let reconnectTimer: Timer = null;
    let fallbackTimer: Timer = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let pongTimer: Timer = null;
    let resyncTimer: ReturnType<typeof setInterval> | null = null;
    let fetching = false;

    const clear = (t: Timer) => t && clearTimeout(t);

    const fetchOnce = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const next = await api.listCurrent();
        if (!cancelled) setRows(next);
      } catch (e) {
        log('live', 'status fetch failed', e instanceof Error ? e.message : e);
      } finally {
        fetching = false;
      }
    };

    // ── 폴링 (실시간 연결이 없을 때만) ──
    const poll = async () => {
      pollTimer = null;
      if (cancelled || !active || wsOpen) return;
      await fetchOnce();
      if (!cancelled && active && !wsOpen) pollTimer = setTimeout(poll, pollIntervalMs);
    };
    const startPolling = () => {
      if (pollTimer || wsOpen || !active) return;
      setTransport('polling');
      pollTimer = setTimeout(poll, 0);
    };
    const stopPolling = () => {
      clear(pollTimer);
      pollTimer = null;
    };

    // ── WebSocket ──
    const stopKeepAlive = () => {
      if (pingTimer) clearInterval(pingTimer);
      if (resyncTimer) clearInterval(resyncTimer);
      clear(pongTimer);
      pingTimer = resyncTimer = pongTimer = null;
    };

    const connect = () => {
      reconnectTimer = null;
      if (cancelled || !active || !liveUpdates || !LIVE_SUPPORTED || ws) return;
      const url = `${serverUrl.replace(/^http/i, 'ws')}/api/live`;
      const Socket = WebSocket as unknown as RNWebSocketCtor;
      const sock = new Socket(url, null, { headers: { Authorization: `Bearer ${apiToken}` } });
      ws = sock;

      // 일정 시간 안에 안 열리면 기다리는 동안 폴링으로 화면을 움직이게 함
      clear(fallbackTimer);
      fallbackTimer = setTimeout(startPolling, FALLBACK_AFTER_MS);

      sock.onopen = () => {
        if (ws !== sock) return;
        attempt = 0;
        wsOpen = true;
        clear(fallbackTimer);
        stopPolling();
        setTransport('live');
        pingTimer = setInterval(() => {
          try {
            sock.send('ping');
          } catch {
            return;
          }
          clear(pongTimer);
          pongTimer = setTimeout(() => sock.close(), PONG_TIMEOUT_MS); // 응답이 없으면 끊고 재연결
        }, PING_MS);
        resyncTimer = setInterval(fetchOnce, RESYNC_MS);
      };

      sock.onmessage = (ev) => {
        if (ws !== sock) return;
        const data = String(ev.data);
        if (data === 'pong') {
          clear(pongTimer);
          return;
        }
        try {
          const msg = JSON.parse(data) as { type?: string; rows?: CurrentRow[] };
          if (msg.type === 'current' && Array.isArray(msg.rows)) setRows(msg.rows);
        } catch {
          // 알 수 없는 메시지
        }
      };

      sock.onerror = () => {
        // 이어서 onclose 가 호출됨
      };

      sock.onclose = () => {
        if (ws !== sock) return;
        ws = null;
        wsOpen = false;
        stopKeepAlive();
        clear(fallbackTimer);
        if (cancelled || !active) return;
        // 끊긴 동안은 폴링으로 버티고, 점점 간격을 늘려 재연결
        startPolling();
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++);
        log('live', `socket closed – retry in ${delay}ms`);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    const disconnect = () => {
      const sock = ws;
      ws = null;
      wsOpen = false;
      stopKeepAlive();
      [reconnectTimer, fallbackTimer].forEach(clear);
      reconnectTimer = fallbackTimer = null;
      stopPolling();
      try {
        sock?.close();
      } catch {
        // 이미 닫힘
      }
    };

    const start = () => {
      if (liveUpdates && LIVE_SUPPORTED) connect();
      else startPolling();
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (Platform.OS === 'web') return;
      if (state === 'active' && !active) {
        active = true;
        start();
      } else if (state === 'background' && active) {
        active = false;
        disconnect();
        setTransport('off');
      }
    });

    if (active) start();
    return () => {
      cancelled = true;
      sub.remove();
      disconnect();
    };
  }, [api, serverUrl, apiToken, pollIntervalMs, liveUpdates]);

  const value = useMemo(() => ({ rows, transport: serverUrl ? transport : 'off' }), [rows, transport, serverUrl]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLiveTransport(): LiveTransport {
  return useContext(LiveContext).transport;
}

/** 주어진 status 중 하나인 가장 최근 currentdata 행의 status (없으면 null) */
export function useCurrentStatus(statuses: readonly string[]): string | null {
  const { rows } = useContext(LiveContext);
  if (!rows) return null;
  for (const row of rows) {
    const s = row.status?.toLowerCase();
    if (s && statuses.includes(s)) return s;
  }
  return null;
}

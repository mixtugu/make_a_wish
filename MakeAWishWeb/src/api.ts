import { useEffect, useState } from 'react';

/**
 * Make a Wish 서버(Cloudflare Worker, ../../MakeAWishServer) 클라이언트.
 *
 * 토큰은 빌드에 넣지 않고, 처음 열 때 화면에서 입력받아 이 브라우저(localStorage)에만 저장합니다.
 * 서버 주소의 기본값만 Vite 환경변수(.env)로 넣을 수 있습니다.
 *   VITE_SERVER_URL=https://make-a-wish-server.<계정>.workers.dev
 */
const DEFAULT_SERVER_URL = normalizeServerUrl(String(import.meta.env.VITE_SERVER_URL ?? ''));
const STORAGE_KEY = 'makeawish.server';
/** 토큰이 없거나 서버가 401 을 주면 발생 → 연결 화면으로 돌아감 */
export const AUTH_EVENT = 'makeawish:auth-required';

export type ServerConfig = { url: string; token: string };

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function loadConfig(): ServerConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<ServerConfig>;
    return { url: saved.url || DEFAULT_SERVER_URL, token: saved.token ?? '' };
  } catch {
    return { url: DEFAULT_SERVER_URL, token: '' };
  }
}

export function saveConfig(cfg: ServerConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: normalizeServerUrl(cfg.url), token: cfg.token.trim() }));
  } catch (e) {
    console.error('설정 저장 실패', e);
  }
}

/** 저장된 토큰을 지우고 연결 화면을 띄움 */
export function forgetToken(): void {
  saveConfig({ ...loadConfig(), token: '' });
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export class AuthError extends Error {}

export type UnlockedRow = {
  id: string;
  image_url: string | null;
  created_at?: string | null;
};

export type FrameLayout = {
  id: string; // 'frame-1' ~ 'frame-20'
  x: number;
  y: number;
  w: number;
  h: number;
};

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  testCfg?: ServerConfig,
): Promise<T> {
  const cfg = testCfg ?? loadConfig();
  if (!cfg.url) throw new Error('서버 주소가 설정되지 않았습니다');
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${cfg.token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 401) {
    if (!testCfg) forgetToken(); // 저장된 토큰이 틀림 → 연결 화면으로
    throw new AuthError('토큰이 올바르지 않습니다');
  }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export function normalizeFrames(list: unknown): FrameLayout[] {
  const frames = (Array.isArray(list) ? (list as Record<string, unknown>[]) : []).map((r) => ({
    id: String(r.id),
    x: Number(r.x),
    y: Number(r.y),
    w: Number(r.w),
    h: Number(r.h),
  }));
  // id의 숫자 부분으로 정렬: frame-1, frame-2, ...
  return frames.sort((a, b) => {
    const na = parseInt(a.id.split('-')[1] || '0', 10);
    const nb = parseInt(b.id.split('-')[1] || '0', 10);
    return na - nb;
  });
}

export const api = {
  /** 연결 화면의 확인용: 저장하기 전 주소·토큰으로 한 번 불러 봄 */
  async test(cfg: ServerConfig): Promise<void> {
    await request('GET', '/api/unlocked', undefined, { url: normalizeServerUrl(cfg.url), token: cfg.token.trim() });
  },

  async listUnlocked(): Promise<UnlockedRow[]> {
    const { rows } = await request<{ rows?: UnlockedRow[] }>('GET', '/api/unlocked');
    return rows ?? [];
  },

  /** unlockeddata 한 행 삭제 (서버의 그림 파일은 유지) */
  async deleteUnlocked(id: string): Promise<number> {
    const { deleted } = await request<{ deleted?: number }>('DELETE', `/api/unlocked/${encodeURIComponent(id)}`);
    return deleted ?? 0;
  },

  async listLayouts(): Promise<FrameLayout[]> {
    const { frames } = await request<{ frames?: unknown }>('GET', '/api/layouts');
    return normalizeFrames(frames);
  },

  async saveLayouts(frames: FrameLayout[]): Promise<void> {
    await request('PUT', '/api/layouts', { frames });
  },

  /** currentdata 전체 삭제 + lockeddata 중복(nfc_id) 중 오래된 것만 남김 */
  async cleanup(): Promise<{ current: number; locked: number }> {
    return request('POST', '/api/cleanup');
  },
};

const PING_MS = 45_000;
const RETRY_MAX_MS = 30_000;

/**
 * 프로젝터 화면용 실시간 데이터.
 * 서버 WebSocket(/api/live?channel=display) 이 연결 즉시, 그리고 바뀔 때마다
 * unlockeddata(최신 20개)와 프레임 배치를 보내 줍니다. 끊기면 자동으로 다시 연결합니다.
 * (브라우저는 WebSocket 의 401 을 알 수 없어서, 연결 전에 HTTP 로 토큰을 먼저 확인합니다)
 */
export function useDisplayData() {
  const [rows, setRows] = useState<UnlockedRow[]>([]);
  const [frames, setFrames] = useState<FrameLayout[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const reconnectLater = () => {
      if (stopped) return;
      const delay = Math.min(RETRY_MAX_MS, 1000 * 2 ** attempt++);
      retry = setTimeout(connect, delay);
    };

    const connect = async () => {
      const cfg = loadConfig();
      try {
        setRows(await api.listUnlocked());
      } catch (err) {
        if (err instanceof AuthError) return; // 연결 화면으로 넘어감
        console.error(err);
        return reconnectLater();
      }
      if (stopped) return;
      const url = new URL(`${cfg.url.replace(/^http/, 'ws')}/api/live`);
      url.searchParams.set('channel', 'display');
      url.searchParams.set('token', cfg.token);
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
      };
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string' || e.data === 'pong') return;
        try {
          const msg = JSON.parse(e.data) as { type?: string; rows?: UnlockedRow[]; frames?: unknown };
          if (msg.type === 'unlocked' && Array.isArray(msg.rows)) setRows(msg.rows.filter((r) => !!r.image_url));
          if (msg.type === 'layouts') setFrames(normalizeFrames(msg.frames));
        } catch (err) {
          console.error('잘못된 메시지', err);
        }
      };
      ws.onclose = () => {
        clearInterval(ping);
        setConnected(false);
        reconnectLater();
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      stopped = true;
      clearInterval(ping);
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  return { rows, setRows, frames, connected };
}

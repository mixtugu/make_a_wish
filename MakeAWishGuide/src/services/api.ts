/**
 * Make a Wish 서버(Cloudflare Worker, ../../MakeAWishServer) 클라이언트.
 * 상태 이관 로직은 서버가 트랜잭션으로 처리하고, 앱은 단계별 요청만 보냅니다.
 */
export interface ApiConfig {
  /** 예: https://make-a-wish-server.<계정>.workers.dev */
  url: string;
  token: string;
}

export interface CurrentRow {
  id: string;
  status: string | null;
  nfc_id: string | null;
  created_at: string;
  updated_at: string;
}

const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function request<T>(
  cfg: ApiConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Uint8Array | Record<string, unknown>,
): Promise<T> {
  if (!cfg.url) throw new ApiError('서버 주소가 설정되지 않았습니다', 0, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${cfg.token}`,
  };
  let payload: BodyInit | undefined;
  if (body instanceof Uint8Array) {
    headers['Content-Type'] = 'image/png';
    payload = body as unknown as BodyInit;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${cfg.url}${path}`, { method, headers, body: payload, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new ApiError(`${method} ${path} → HTTP ${res.status}`, res.status, text);
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function createApi(cfg: ApiConfig) {
  return {
    config: cfg,

    /** currentdata 행 목록 (최신순) */
    async listCurrent(): Promise<CurrentRow[]> {
      const { rows } = await request<{ rows?: CurrentRow[] }>(cfg, 'GET', '/api/current');
      return rows ?? [];
    },

    /** waiting / unlockwaiting 추가 */
    async insertCurrent(status: string): Promise<void> {
      await request(cfg, 'POST', '/api/current', { status });
    },

    async clearCurrent(): Promise<number> {
      const { deleted } = await request<{ deleted?: number }>(cfg, 'DELETE', '/api/current');
      return deleted ?? 0;
    },

    /** waiting → nfctagged / unlockwaiting → unlocknfctagged */
    async tag(nfcId: string): Promise<{ updated: number; from: string | null; to: string | null }> {
      return request(cfg, 'POST', '/api/tag', { nfcId });
    },

    /** nfctagged 행 + 그림 PNG → lockeddata */
    async lock(image: Uint8Array | null): Promise<{ moved: number; imageUrl: string | null }> {
      return request(cfg, 'POST', '/api/lock', image ?? new Uint8Array());
    },

    /** unlocknfctagged 의 nfc_id 로 lockeddata → unlockeddata */
    async unlock(): Promise<{ moved: number; reason?: string }> {
      return request(cfg, 'POST', '/api/unlock');
    },
  };
}

export type ApiClient = ReturnType<typeof createApi>;

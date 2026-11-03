import { DurableObject, env } from "cloudflare:workers";

/**
 * Make a Wish 가이드 서버
 *
 * 원본 Swift 앱들이 Supabase 에 직접 하던 작업을 Worker 한 곳에서 처리합니다.
 * 상태 이관(currentdata → lockeddata → unlockeddata)은 서버에서 D1 batch(트랜잭션)로 묶어
 * 중간에 끊겨도 데이터가 반쯤만 옮겨지는 일이 없습니다.
 *
 *   GET    /                      상태 확인 (인증 없음)
 *   GET    /images/<key>          소원 그림 PNG (인증 없음, 추측 불가능한 UUID 키)
 *   GET    /api/live              WebSocket. 연결 즉시 + currentdata 가 바뀔 때마다 {type:"current", rows} 를 보내 줌
 *                                 (기기가 1.5초마다 묻지 않아도 되므로 요청 수가 크게 줄어듦. "ping" → "pong")
 *   GET    /api/current           currentdata 행 목록            (WebSocket 이 안 될 때의 폴링, 연결 테스트)
 *   POST   /api/current           {status}  waiting / unlockwaiting 추가 (iPad)
 *   DELETE /api/current           currentdata 전체 비우기 (iPad 감사 화면, 관리 메뉴)
 *   POST   /api/tag               {nfcId}   waiting → nfctagged / unlockwaiting → unlocknfctagged (iPhone, 단축어)
 *   POST   /api/lock              body=PNG  nfctagged 행 + 그림 → lockeddata (iPad)
 *   POST   /api/unlock            unlocknfctagged 의 nfc_id 로 lockeddata → unlockeddata (iPad)
 *
 * /api/* 는 `Authorization: Bearer <API_TOKEN>` 이 필요합니다.
 */

const STATUS = {
	waiting: "waiting",
	nfcTagged: "nfctagged",
	locked: "locked",
	unlockWaiting: "unlockwaiting",
	unlockNfcTagged: "unlocknfctagged",
	unlocked: "unlocked",
} as const;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Row = {
	id: string;
	status: string | null;
	nfc_id: string | null;
	image_url: string | null;
	meta: string | null;
	created_at: string;
};

// ── 스키마 ─────────────────────────────────────────────────────────
// 별도 마이그레이션 단계 없이, Worker 가 처음 요청을 받을 때 테이블을 만듭니다.
const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS currentdata (
		id TEXT PRIMARY KEY,
		status TEXT,
		nfc_id TEXT,
		image_url TEXT,
		meta TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS currentdata_status_idx ON currentdata (status)`,
	`CREATE TABLE IF NOT EXISTS lockeddata (
		id TEXT PRIMARY KEY,
		nfc_id TEXT,
		image_url TEXT,
		status TEXT,
		meta TEXT,
		created_at TEXT NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS lockeddata_nfc_id_idx ON lockeddata (nfc_id)`,
	`CREATE TABLE IF NOT EXISTS unlockeddata (
		id TEXT PRIMARY KEY,
		nfc_id TEXT,
		image_url TEXT,
		status TEXT,
		meta TEXT,
		created_at TEXT NOT NULL
	)`,
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
	schemaReady ??= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql)))
		.then(() => undefined)
		.catch((e: unknown) => {
			schemaReady = null; // 다음 요청에서 다시 시도
			throw e;
		});
	return schemaReady;
}

// ── 공통 ───────────────────────────────────────────────────────────
const now = () => new Date().toISOString();

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
	});
}

const error = (status: number, message: string) => json({ error: message }, status);

async function sha256(text: string): Promise<ArrayBuffer> {
	return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

/** 토큰 비교 (길이·내용에 따른 시간 차이가 나지 않도록 해시 후 timingSafeEqual) */
async function authorized(request: Request): Promise<boolean> {
	const expected = env.API_TOKEN;
	if (!expected) return false; // 토큰을 설정하지 않았으면 모두 거부
	const header = request.headers.get("authorization") ?? "";
	const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
	if (!given) return false;
	const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
	return crypto.subtle.timingSafeEqual(a, b);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

// ── 핸들러 ─────────────────────────────────────────────────────────

async function currentRows(): Promise<unknown[]> {
	const { results } = await env.DB.prepare(
		"SELECT id, status, nfc_id, created_at, updated_at FROM currentdata ORDER BY created_at DESC LIMIT 50",
	).all();
	return results;
}

/** GET /api/current */
async function listCurrent(): Promise<Response> {
	return json({ rows: await currentRows() });
}

// ── 실시간 알림 (Durable Object) ──────────────────────────────────
/**
 * 모든 기기의 WebSocket 을 하나의 객체가 붙잡고 있다가, currentdata 가 바뀌면 한꺼번에 알려 줍니다.
 * Hibernation API 를 쓰므로 연결만 열려 있고 메시지가 없는 동안에는 사용 시간이 과금되지 않습니다.
 * 앱의 keep-alive "ping" 은 객체를 깨우지 않고 런타임이 바로 "pong" 으로 응답합니다.
 */
export class WishHub extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
			return error(426, "WebSocket 연결이 필요합니다");
		}
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server);
		// 연결하자마자 현재 상태를 보내 줌 (재연결 중에 놓친 변화도 이걸로 맞춰짐)
		try {
			await ensureSchema();
			server.send(JSON.stringify({ type: "current", rows: await currentRows() }));
		} catch (e) {
			console.error("initial snapshot failed", e);
		}
		return new Response(null, { status: 101, webSocket: client });
	}

	/** 연결된 모든 기기에 최신 currentdata 전송 */
	broadcast(rows: unknown[]): number {
		const message = JSON.stringify({ type: "current", rows });
		let sent = 0;
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(message);
				sent++;
			} catch {
				// 이미 끊긴 연결
			}
		}
		return sent;
	}

	webSocketMessage(): void {
		// 앱이 보내는 메시지는 "ping" 뿐이고 자동 응답으로 처리됨
	}

	webSocketClose(ws: WebSocket, code: number, reason: string): void {
		try {
			ws.close(code, reason);
		} catch {
			// 이미 닫힘
		}
	}
}

// 이름(문자열)으로 자기 자신을 가리키는 바인딩이라 클래스 타입이 추론되지 않아 명시
const hub = () => (env.HUB as DurableObjectNamespace<WishHub>).getByName("main");

async function notifyChanged(): Promise<void> {
	try {
		await hub().broadcast(await currentRows());
	} catch (e) {
		console.error("broadcast failed", e);
	}
}

/** POST /api/current {status} – 원본 CurrentInsert (status 만 기록) */
async function insertCurrent(request: Request): Promise<Response> {
	const { status } = await readJson(request);
	if (status !== STATUS.waiting && status !== STATUS.unlockWaiting) {
		return error(400, "status 는 waiting 또는 unlockwaiting 이어야 합니다");
	}
	const id = crypto.randomUUID();
	const ts = now();
	await env.DB.prepare(
		"INSERT INTO currentdata (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)",
	)
		.bind(id, status, ts, ts)
		.run();
	return json({ id, status }, 201);
}

/** DELETE /api/current – 원본 ThankView 의 currentdata 전체 삭제 */
async function clearCurrent(): Promise<Response> {
	const res = await env.DB.prepare("DELETE FROM currentdata").run();
	return json({ deleted: res.meta.changes ?? 0 });
}

/**
 * POST /api/tag {nfcId}
 * 가장 최근의 waiting / unlockwaiting 을 찾아 태그된 상태로 바꾸고 nfc_id 를 기록합니다.
 * (원본에서는 앱 밖의 무언가가 하던 일 – iOS 단축어에서 이 주소를 호출하면 됩니다)
 */
async function tag(request: Request, url: URL): Promise<Response> {
	const body = await readJson(request);
	const raw = body.nfcId ?? body.nfc_id ?? url.searchParams.get("nfcId");
	const nfcId = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
	if (!nfcId || nfcId.length > 128) return error(400, "nfcId 가 필요합니다");

	const current = await env.DB.prepare(
		"SELECT status FROM currentdata WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 1",
	)
		.bind(STATUS.waiting, STATUS.unlockWaiting)
		.first<{ status: string }>();
	if (!current) return json({ updated: 0, from: null, to: null });

	const from = current.status;
	const to = from === STATUS.unlockWaiting ? STATUS.unlockNfcTagged : STATUS.nfcTagged;
	const res = await env.DB.prepare(
		"UPDATE currentdata SET status = ?, nfc_id = ?, updated_at = ? WHERE status = ?",
	)
		.bind(to, nfcId, now(), from)
		.run();
	return json({ updated: res.meta.changes ?? 0, from, to });
}

/**
 * POST /api/lock  (body: image/png, 비어 있어도 됨)
 * 원본 SavedNextView.transferNfcTaggedAndClear():
 * nfctagged 행을 lockeddata(status=locked) 로 옮기고 currentdata 에서 삭제.
 */
async function lock(request: Request, url: URL): Promise<Response> {
	const { results: rows } = await env.DB.prepare("SELECT * FROM currentdata WHERE status = ?")
		.bind(STATUS.nfcTagged)
		.all<Row>();
	if (!rows.length) return json({ moved: 0, imageUrl: null });

	// 그림 업로드 (실패해도 이관은 진행 – 원본 동작)
	let imageUrl: string | null = null;
	const length = Number(request.headers.get("content-length") ?? "0");
	if (length > MAX_IMAGE_BYTES) return error(413, "이미지가 너무 큽니다");
	const bytes = await request.arrayBuffer();
	if (bytes.byteLength > 0 && bytes.byteLength <= MAX_IMAGE_BYTES) {
		const key = `${crypto.randomUUID()}.png`;
		try {
			await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
			imageUrl = `${url.origin}/images/${key}`;
		} catch (e) {
			console.error("image upload failed", e);
		}
	}

	const insert = env.DB.prepare(
		"INSERT OR IGNORE INTO lockeddata (id, nfc_id, image_url, status, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	);
	const statements = rows.map((r) =>
		insert.bind(r.id, r.nfc_id, imageUrl ?? r.image_url, STATUS.locked, r.meta, r.created_at),
	);
	// 옮긴 행만 정확히 삭제 (그 사이 새로 생긴 행은 건드리지 않음)
	statements.push(
		env.DB.prepare(`DELETE FROM currentdata WHERE id IN (${placeholders(rows.length)})`).bind(
			...rows.map((r) => r.id),
		),
	);
	await env.DB.batch(statements);
	return json({ moved: rows.length, imageUrl });
}

/**
 * POST /api/unlock
 * 원본 RemoveTouchView.transferUnlockAndClear():
 * unlocknfctagged 행의 nfc_id 로 lockeddata 를 찾아 unlockeddata(status=unlocked) 로 옮기고 정리.
 */
async function unlock(): Promise<Response> {
	const { results: current } = await env.DB.prepare("SELECT * FROM currentdata WHERE status = ?")
		.bind(STATUS.unlockNfcTagged)
		.all<Row>();
	if (!current.length) return json({ moved: 0 });

	const nfcIds = [...new Set(current.map((r) => r.nfc_id).filter((v): v is string => !!v))];
	if (!nfcIds.length) return json({ moved: 0, reason: "nfc_id 없음" });

	const found = await env.DB.batch<Row>(
		nfcIds.map((nfc) =>
			env.DB.prepare("SELECT * FROM lockeddata WHERE nfc_id = ? ORDER BY created_at LIMIT 1").bind(nfc),
		),
	);
	const locked = found.map((r) => r.results[0]).filter((r): r is Row => !!r);
	if (!locked.length) return json({ moved: 0, reason: "일치하는 lockeddata 없음" });

	const ts = now();
	const insert = env.DB.prepare(
		"INSERT OR IGNORE INTO unlockeddata (id, nfc_id, image_url, status, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	);
	const statements = locked.map((r) =>
		insert.bind(r.id, r.nfc_id, r.image_url, STATUS.unlocked, r.meta, ts),
	);
	statements.push(
		env.DB.prepare(`DELETE FROM currentdata WHERE id IN (${placeholders(current.length)})`).bind(
			...current.map((r) => r.id),
		),
		env.DB.prepare(`DELETE FROM lockeddata WHERE nfc_id IN (${placeholders(nfcIds.length)})`).bind(...nfcIds),
	);
	await env.DB.batch(statements);
	return json({ moved: locked.length });
}

/** GET /images/<key> */
async function image(key: string): Promise<Response> {
	if (!/^[0-9a-f-]{36}\.png$/.test(key)) return error(404, "not found");
	const object = await env.IMAGES.get(key);
	if (!object) return error(404, "not found");
	return new Response(object.body, {
		headers: {
			"content-type": "image/png",
			"cache-control": "public, max-age=31536000, immutable",
			etag: object.httpEtag,
		},
	});
}

// ── 라우터 ─────────────────────────────────────────────────────────
export default {
	async fetch(request, _env, ctx) {
		const response = await route(request);
		// 상태를 바꾸는 요청이 성공하면 연결된 기기들에 바로 알림
		if (request.method !== "GET" && response.ok && new URL(request.url).pathname.startsWith("/api/")) {
			ctx.waitUntil(notifyChanged());
		}
		return response;
	},
} satisfies ExportedHandler<Env>;

async function route(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method;

	try {
		if (pathname === "/" && method === "GET") {
			return new Response("Make a Wish server OK\n", { headers: { "content-type": "text/plain" } });
		}
		if (pathname.startsWith("/images/") && method === "GET") {
			return await image(pathname.slice("/images/".length));
		}
		if (!pathname.startsWith("/api/")) return error(404, "not found");

		if (!(await authorized(request))) return error(401, "unauthorized");
		await ensureSchema();

		switch (`${method} ${pathname}`) {
			case "GET /api/live":
				return await hub().fetch(request);
			case "GET /api/current":
				return await listCurrent();
			case "POST /api/current":
				return await insertCurrent(request);
			case "DELETE /api/current":
				return await clearCurrent();
			case "POST /api/tag":
				return await tag(request, url);
			case "POST /api/lock":
				return await lock(request, url);
			case "POST /api/unlock":
				return await unlock();
			default:
				return error(404, "not found");
		}
	} catch (e) {
		console.error(`${method} ${pathname} failed`, e);
		return error(500, "internal error");
	}
}

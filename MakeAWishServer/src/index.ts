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
 *          /api/live?channel=display  프로젝터 웹용. {type:"unlocked", rows} / {type:"layouts", frames} 를 보내 줌
 *                                 (브라우저는 WebSocket 헤더를 못 넣으므로 ?token=<API_TOKEN> 도 허용)
 *   GET    /api/current           currentdata 행 목록            (WebSocket 이 안 될 때의 폴링, 연결 테스트)
 *   POST   /api/current           {status}  waiting / unlockwaiting 추가 (iPad)
 *   DELETE /api/current           currentdata 전체 비우기 (iPad 감사 화면, 관리 메뉴)
 *   POST   /api/tag               {nfcId}   waiting → nfctagged / unlockwaiting → unlocknfctagged (iPhone, 단축어)
 *   POST   /api/lock              body=PNG  nfctagged 행 + 그림 → lockeddata (iPad)
 *   POST   /api/unlock            unlocknfctagged 의 nfc_id 로 lockeddata → unlockeddata (iPad)
 *   POST   /api/cleanup           currentdata 비우기 + lockeddata 중복(nfc_id) 정리 (웹 설정 화면)
 *   GET    /api/unlocked          프로젝터에 띄울 unlockeddata (최신 20개, 그림 있는 것만)
 *   DELETE /api/unlocked/<id>     unlockeddata 한 행 삭제 (R2 그림은 남겨 둠)
 *   GET    /api/layouts           프로젝터 프레임 배치 (frame-1 ~ frame-20)
 *   PUT    /api/layouts           {frames:[{id,x,y,w,h}]} 프레임 배치 저장
 *
 * /api/* 는 `Authorization: Bearer <API_TOKEN>` 이 필요합니다.
 * 웹(다른 주소)에서도 부를 수 있도록 CORS 를 허용합니다 (쿠키가 아닌 토큰 인증이라 안전).
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
/** 프로젝터에 동시에 보이는 그림 수 (= 프레임 수) */
const DISPLAY_SLOTS = 20;
const MAX_FRAMES = 50;

/** WebSocket 채널: 가이드 앱(current) / 프로젝터 웹(display) */
type Channel = "current" | "display";

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
	`CREATE INDEX IF NOT EXISTS unlockeddata_created_at_idx ON unlockeddata (created_at)`,
	`CREATE TABLE IF NOT EXISTS setting_layouts (
		id TEXT PRIMARY KEY,
		x INTEGER NOT NULL,
		y INTEGER NOT NULL,
		w INTEGER NOT NULL,
		h INTEGER NOT NULL,
		updated_at TEXT NOT NULL
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

const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
	"access-control-allow-headers": "authorization, content-type",
	"access-control-max-age": "86400",
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS_HEADERS },
	});
}

const error = (status: number, message: string) => json({ error: message }, status);

async function sha256(text: string): Promise<ArrayBuffer> {
	return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
}

/** 토큰 비교 (길이·내용에 따른 시간 차이가 나지 않도록 해시 후 timingSafeEqual) */
async function authorized(request: Request, url: URL): Promise<boolean> {
	const expected = env.API_TOKEN;
	if (!expected) return false; // 토큰을 설정하지 않았으면 모두 거부
	const header = request.headers.get("authorization") ?? "";
	let given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
	// 브라우저 WebSocket 은 헤더를 넣을 수 없어 /api/live 에 한해 ?token= 허용
	if (!given && url.pathname === "/api/live") given = url.searchParams.get("token")?.trim() ?? "";
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

async function unlockedRows(): Promise<unknown[]> {
	const { results } = await env.DB.prepare(
		"SELECT id, image_url, created_at FROM unlockeddata WHERE image_url IS NOT NULL ORDER BY created_at DESC LIMIT ?",
	)
		.bind(DISPLAY_SLOTS)
		.all();
	return results;
}

async function layoutRows(): Promise<unknown[]> {
	const { results } = await env.DB.prepare("SELECT id, x, y, w, h FROM setting_layouts").all();
	return results;
}

const snapshot = {
	current: async () => ({ type: "current", rows: await currentRows() }),
	unlocked: async () => ({ type: "unlocked", rows: await unlockedRows() }),
	layouts: async () => ({ type: "layouts", frames: await layoutRows() }),
};

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
		const channel: Channel =
			new URL(request.url).searchParams.get("channel") === "display" ? "display" : "current";
		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server, [channel]);
		// 연결하자마자 현재 상태를 보내 줌 (재연결 중에 놓친 변화도 이걸로 맞춰짐)
		try {
			await ensureSchema();
			const messages =
				channel === "display"
					? await Promise.all([snapshot.unlocked(), snapshot.layouts()])
					: [await snapshot.current()];
			for (const m of messages) server.send(JSON.stringify(m));
		} catch (e) {
			console.error("initial snapshot failed", e);
		}
		return new Response(null, { status: 101, webSocket: client });
	}

	/** 해당 채널에 연결된 모든 기기에 메시지 전송 */
	broadcast(channel: Channel, data: unknown): number {
		const message = JSON.stringify(data);
		let sent = 0;
		for (const ws of this.ctx.getWebSockets(channel)) {
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

type Change = "current" | "unlocked" | "layouts";

/** 상태를 바꾸는 요청이 어떤 데이터를 바꾸는지 */
function changesOf(method: string, pathname: string): Change[] {
	if (method === "GET") return [];
	if (pathname === "/api/unlock") return ["current", "unlocked"];
	if (pathname.startsWith("/api/unlocked/")) return ["unlocked"];
	if (pathname === "/api/layouts") return ["layouts"];
	if (pathname.startsWith("/api/")) return ["current"];
	return [];
}

async function notifyChanged(changes: Change[]): Promise<void> {
	await Promise.all(
		changes.map(async (change) => {
			try {
				const channel: Channel = change === "current" ? "current" : "display";
				await hub().broadcast(channel, await snapshot[change]());
			} catch (e) {
				console.error(`broadcast ${change} failed`, e);
			}
		}),
	);
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

/**
 * POST /api/cleanup – 원본 웹 설정 화면의 clear 버튼:
 * currentdata 전체 삭제 + lockeddata 에서 같은 nfc_id 가 여러 개면 가장 오래된 것만 남김.
 */
async function cleanup(): Promise<Response> {
	const [current, locked] = await env.DB.batch([
		env.DB.prepare("DELETE FROM currentdata"),
		env.DB.prepare(
			`DELETE FROM lockeddata WHERE id NOT IN (
				SELECT id FROM (
					SELECT id, ROW_NUMBER() OVER (PARTITION BY nfc_id ORDER BY created_at) AS rn FROM lockeddata
				) WHERE rn = 1
			)`,
		),
	]);
	return json({ current: current.meta.changes ?? 0, locked: locked.meta.changes ?? 0 });
}

/** GET /api/unlocked */
async function listUnlocked(): Promise<Response> {
	return json({ rows: await unlockedRows() });
}

/** DELETE /api/unlocked/<id> – 프로젝터 화면에서 그림 내리기 (R2 의 그림 파일은 유지) */
async function deleteUnlocked(id: string): Promise<Response> {
	if (!id || id.length > 64) return error(400, "id 가 필요합니다");
	const res = await env.DB.prepare("DELETE FROM unlockeddata WHERE id = ?").bind(id).run();
	return json({ deleted: res.meta.changes ?? 0 });
}

/** GET /api/layouts */
async function listLayouts(): Promise<Response> {
	return json({ frames: await layoutRows() });
}

/** PUT /api/layouts {frames:[{id,x,y,w,h}]} – 보낸 프레임만 저장/갱신 */
async function saveLayouts(request: Request): Promise<Response> {
	const { frames } = await readJson(request);
	if (!Array.isArray(frames) || frames.length > MAX_FRAMES) return error(400, "frames 배열이 필요합니다");

	const valid = frames.every(
		(f) =>
			f &&
			typeof f === "object" &&
			typeof f.id === "string" &&
			/^frame-\d{1,2}$/.test(f.id) &&
			["x", "y", "w", "h"].every((k) => Number.isFinite(f[k]) && Math.abs(f[k]) <= 100_000),
	);
	if (!valid) return error(400, "frames 형식이 올바르지 않습니다");
	if (!frames.length) return json({ saved: 0 });

	const ts = now();
	const upsert = env.DB.prepare(
		`INSERT INTO setting_layouts (id, x, y, w, h, updated_at) VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (id) DO UPDATE SET x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, updated_at = excluded.updated_at`,
	);
	await env.DB.batch(
		frames.map((f) =>
			upsert.bind(f.id, Math.round(f.x), Math.round(f.y), Math.round(f.w), Math.round(f.h), ts),
		),
	);
	return json({ saved: frames.length });
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
			"access-control-allow-origin": "*",
			etag: object.httpEtag,
		},
	});
}

// ── 라우터 ─────────────────────────────────────────────────────────
export default {
	async fetch(request, _env, ctx) {
		const response = await route(request);
		// 상태를 바꾸는 요청이 성공하면 연결된 기기들에 바로 알림
		const changes = response.ok ? changesOf(request.method, new URL(request.url).pathname) : [];
		if (changes.length) ctx.waitUntil(notifyChanged(changes));
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
		if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

		if (!(await authorized(request, url))) return error(401, "unauthorized");
		await ensureSchema();

		if (pathname.startsWith("/api/unlocked/") && method === "DELETE") {
			return await deleteUnlocked(decodeURIComponent(pathname.slice("/api/unlocked/".length)));
		}

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
			case "POST /api/cleanup":
				return await cleanup();
			case "GET /api/unlocked":
				return await listUnlocked();
			case "GET /api/layouts":
				return await listLayouts();
			case "PUT /api/layouts":
				return await saveLayouts(request);
			default:
				return error(404, "not found");
		}
	} catch (e) {
		console.error(`${method} ${pathname} failed`, e);
		return error(500, "internal error");
	}
}

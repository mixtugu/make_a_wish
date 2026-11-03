import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

const WORKER_NAME = "make-a-wish-server";

/**
 * Make a Wish 가이드 서버 (Cloudflare Worker)
 * - DB:        D1 (currentdata / lockeddata / unlockeddata)
 * - IMAGES:    R2 (소원 그림 PNG)
 * - HUB:       Durable Object – 기기들의 WebSocket 을 붙잡고 있다가 상태가 바뀌면 바로 알려 줌
 * - API_TOKEN: 앱과 공유하는 접근 토큰 (secret)
 *
 * D1 데이터베이스와 R2 버킷은 `cf deploy` 할 때 없으면 자동으로 만들어집니다.
 */
export default defineConfig({
	worker: {
		name: WORKER_NAME,
		compatibilityDate: "2026-11-01",
		entrypoint,
		exports: {
			// 무료 플랜은 SQLite 저장소 Durable Object 만 사용 가능
			WishHub: exports.durableObject({ storage: "sqlite" }),
		},
		env: {
			DB: bindings.d1({ name: "make-a-wish-db" }),
			IMAGES: bindings.r2({ name: "make-a-wish-drawings" }),
			HUB: bindings.durableObject({ worker: WORKER_NAME, exportName: "WishHub" }),
			API_TOKEN: bindings.secret(),
		},
		observability: { enabled: true },
	},
});

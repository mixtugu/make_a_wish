import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

/**
 * Make a Wish 가이드 서버 (Cloudflare Worker)
 * - DB:        D1 (currentdata / lockeddata / unlockeddata)
 * - IMAGES:    R2 (소원 그림 PNG)
 * - API_TOKEN: 앱과 공유하는 접근 토큰 (secret)
 *
 * D1 데이터베이스와 R2 버킷은 `cf deploy` 할 때 없으면 자동으로 만들어집니다.
 */
export default defineConfig({
	worker: {
		name: "make-a-wish-server",
		compatibilityDate: "2026-11-01",
		entrypoint,
		env: {
			DB: bindings.d1({ name: "make-a-wish-db" }),
			IMAGES: bindings.r2({ name: "make-a-wish-drawings" }),
			API_TOKEN: bindings.secret(),
		},
		observability: { enabled: true },
	},
});

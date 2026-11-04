import { defineConfig } from "cf/config";

/**
 * Make a Wish 프로젝터 웹 (Cloudflare Workers 정적 사이트)
 * - Worker 코드 없이 Vite 빌드 결과(dist)만 올림
 * - /setting 처럼 파일이 없는 주소도 index.html 로 응답 (SPA)
 * 토큰은 빌드에 들어가지 않으므로 공개 주소로 올려도 됩니다 (처음 열 때 화면에서 입력).
 */
export default defineConfig({
	worker: {
		name: "make-a-wish-display",
		compatibilityDate: "2026-11-01",
		assets: { notFoundHandling: "single-page-application" },
	},
});

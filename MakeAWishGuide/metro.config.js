// Expo 기본 Metro 설정 + 브라우저 테스트용 API 중계
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * 브라우저에서 테스트할 때(npx expo start --web)만 쓰는 중계.
 * 브라우저는 다른 주소의 서버에 토큰 헤더를 붙여 요청할 수 없으므로(CORS),
 * 앱이 /__api/... 로 보내면 이 개발 서버가 대신 Make a Wish 서버로 전달합니다.
 * - 대상 서버 주소는 앱 설정의 Server URL (x-mw-target 헤더). https 주소 또는 http://localhost 만 허용
 * - iPhone/iPad 앱과 실제 서버에는 영향 없음
 */
const PREFIX = '/__api/';

async function proxy(req, res) {
  const target = String(req.headers['x-mw-target'] || '').replace(/\/+$/, '');
  // https 서버, 또는 이 PC 에서 띄운 로컬 서버만 허용
  if (!/^https:\/\/[^/]+$/.test(target) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(target)) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'x-mw-target must be an https server URL (or http://localhost)' }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = {};
  for (const name of ['authorization', 'content-type', 'accept']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  try {
    const upstream = await fetch(target + req.url.slice(PREFIX.length - 1), {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `proxy failed: ${e instanceof Error ? e.message : String(e)}` }));
  }
}

const previous = config.server && config.server.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => {
      if (req.url && req.url.startsWith(PREFIX)) {
        proxy(req, res);
        return;
      }
      return base(req, res, next);
    };
  },
};

module.exports = config;

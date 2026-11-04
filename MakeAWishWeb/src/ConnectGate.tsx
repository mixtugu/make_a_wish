import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, AUTH_EVENT, AuthError, loadConfig, saveConfig } from './api';

/**
 * 서버 주소·토큰이 없으면(또는 토큰이 틀리면) 입력 화면을 보여 주고, 있으면 children 을 그림.
 * 토큰은 빌드 결과에 들어가지 않고 이 브라우저의 localStorage 에만 저장됩니다.
 */
export default function ConnectGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !!loadConfig().token);
  const [url, setUrl] = useState(() => loadConfig().url);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onAuth = () => {
      setReady(false);
      setMessage('토큰이 올바르지 않거나 없습니다. 다시 입력해 주세요.');
    };
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, []);

  if (ready) return <>{children}</>;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('연결 확인 중...');
    try {
      await api.test({ url, token });
      saveConfig({ url, token });
      setToken('');
      setMessage('');
      setReady(true);
    } catch (err) {
      setMessage(err instanceof AuthError ? '토큰이 올바르지 않습니다.' : `연결 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { padding: '8px 10px', fontSize: 14, border: '1px solid #cbd5e1', borderRadius: 6, color: '#0f172a', background: '#ffffff' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10, color: '#0f172a', fontSize: 13 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Make a Wish 서버 연결</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          서버 주소
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://make-a-wish-server.<계정>.workers.dev" required style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          API 토큰
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required style={inputStyle} />
        </label>
        <button type="submit" disabled={busy} style={{ padding: '8px 12px', fontSize: 14, color: '#ffffff', background: busy ? '#94a3b8' : '#0f172a', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}>
          {busy ? '확인 중…' : '연결'}
        </button>
        {message && <div style={{ color: '#64748b', whiteSpace: 'pre-wrap' }}>{message}</div>}
        <div style={{ color: '#94a3b8', fontSize: 12 }}>토큰은 이 브라우저에만 저장됩니다.</div>
      </form>
    </div>
  );
}

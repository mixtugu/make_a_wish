import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { DEFAULT_SETTINGS, type AppSettings, type GuideMode } from '../config/defaults';
import { isAppLanguage } from '../i18n/types';
import { webModeOverride } from '../utils/webMode';

// 브라우저 테스트: 주소의 ?mode= 가 있으면 그 모드로 (앱에서는 null)
const WEB_MODE = webModeOverride();

const STORAGE_KEY = 'makeawish.settings.v1';
// 이전 버전의 '마지막 방문자 언어' 저장 키 (이제 매 방문은 기본 언어로 시작하므로 정리만 함)
const LEGACY_LAST_LANGUAGE_KEY = 'makeawish.lastLanguage';

interface SettingsContextValue {
  settings: AppSettings;
  loaded: boolean;
  /** 'auto' 를 실제 기기에 맞춰 해석한 모드 */
  resolvedMode: GuideMode;
  /** 기기가 iPad 인지 (auto 모드 판단 근거) */
  isTabletDevice: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const isTabletDevice = Platform.OS === 'ios' ? Platform.isPad : false;

function sanitize(raw: unknown): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' && raw ? raw : {}) } as AppSettings;
  if (!['auto', 'iphone', 'ipad'].includes(merged.mode)) merged.mode = 'auto';
  // 일본어·영어만 지원 (예전에 한국어·중국어로 저장된 기기는 일본어로)
  if (!isAppLanguage(merged.defaultLanguage)) merged.defaultLanguage = 'ja';
  const poll = Number(merged.pollIntervalMs);
  merged.pollIntervalMs = Number.isFinite(poll) ? Math.min(Math.max(poll, 500), 10000) : 1500;
  const idle = Number(merged.idleResetSeconds);
  merged.idleResetSeconds = Number.isFinite(idle) ? Math.min(Math.max(Math.round(idle), 0), 3600) : 0;
  merged.serverUrl = String(merged.serverUrl || DEFAULT_SETTINGS.serverUrl).trim().replace(/\/+$/, '');
  merged.apiToken = String(merged.apiToken || DEFAULT_SETTINGS.apiToken).trim();
  // 이전 버전(Supabase)의 설정 키 정리
  const legacy = merged as unknown as Record<string, unknown>;
  delete legacy.supabaseUrl;
  delete legacy.supabaseAnonKey;
  delete legacy.storageBucket;
  delete legacy.rememberLastLanguage;
  return merged;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  // 최신 설정값 (update 를 연달아 호출해도 이전 패치가 유실되지 않도록). 렌더 중에는 읽지 않음
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        AsyncStorage.removeItem(LEGACY_LAST_LANGUAGE_KEY).catch(() => {});
        if (raw) {
          const parsed = sanitize(JSON.parse(raw));
          settingsRef.current = parsed;
          setSettings(parsed);
        }
      } catch (e) {
        console.warn('[settings] 불러오기 실패 – 기본값 사용', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = sanitize({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[settings] 저장 실패', e);
    }
  }, []);

  const reset = useCallback(async () => {
    const next = { ...DEFAULT_SETTINGS, setupDone: true };
    settingsRef.current = next;
    setSettings(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loaded,
      resolvedMode:
        WEB_MODE ?? (settings.mode === 'auto' ? (isTabletDevice ? 'ipad' : 'iphone') : settings.mode),
      isTabletDevice,
      update,
      reset,
    }),
    [settings, loaded, update, reset],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

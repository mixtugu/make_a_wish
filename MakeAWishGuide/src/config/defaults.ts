import type { AppLanguage } from '../i18n/types';

/** 'auto' 는 실제 기기(iPad 여부)를 보고 결정합니다. */
export type GuideModeSetting = 'auto' | 'iphone' | 'ipad';
export type GuideMode = Exclude<GuideModeSetting, 'auto'>;

export interface AppSettings {
  /** 최초 실행 시 모드 선택 화면을 보여줬는지 여부 */
  setupDone: boolean;
  /** 어떤 가이드로 동작할지 */
  mode: GuideModeSetting;
  /**
   * Make a Wish 서버(Cloudflare Worker) 주소와 접근 토큰.
   * `.env.local` 의 EXPO_PUBLIC_SERVER_URL / EXPO_PUBLIC_API_TOKEN 이 기본값이 되고,
   * 앱 설정 화면에서 기기별로 다시 덮어쓸 수 있습니다.
   */
  serverUrl: string;
  apiToken: string;
  /** 실시간 연결(WebSocket)로 상태 변화를 받음. 끄면 원본처럼 주기적으로 물어봄 */
  liveUpdates: boolean;
  /** 실시간 연결이 없을 때의 상태 확인 주기(ms). 원본은 1.5초 */
  pollIntervalMs: number;
  /** iPad: 언어 선택 화면에서 처음 선택되어 있는 언어 */
  defaultLanguage: AppLanguage;
  /** iPad: true 면 마지막 방문자가 고른 언어를 다음 방문자에게도 유지 (원본 동작) */
  rememberLastLanguage: boolean;
  /**
   * iPhone: 앱이 직접 NFC 태그를 읽어 currentdata 를 nfctagged / unlocknfctagged 로 바꿉니다.
   * 끄면(기본값) 원본처럼 외부(단축어 자동화 등)가 상태를 바꿔 준다고 가정합니다.
   */
  nfcInAppScan: boolean;
  /** 오른쪽 위 설정(⚙︎) 버튼 표시. 끄면 그 자리를 2초간 길게 눌러야 메뉴가 열림 */
  showSettingsButton: boolean;
  /** 전시용: 화면 꺼짐 방지 */
  keepAwake: boolean;
  /** iPad: 진행 중 아무 입력이 없으면 처음 화면으로 돌아갈 시간(초). 0 = 사용 안 함 */
  idleResetSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  setupDone: false,
  mode: 'auto',
  serverUrl: (process.env.EXPO_PUBLIC_SERVER_URL ?? '').trim().replace(/\/+$/, ''),
  apiToken: (process.env.EXPO_PUBLIC_API_TOKEN ?? '').trim(),
  liveUpdates: true,
  pollIntervalMs: 1500,
  defaultLanguage: 'ja',
  rememberLastLanguage: true,
  nfcInAppScan: false,
  showSettingsButton: true,
  keepAwake: true,
  idleResetSeconds: 0,
};

/** 상태값 (원본과 동일) */
export const STATUS = {
  waiting: 'waiting',
  nfcTagged: 'nfctagged',
  locked: 'locked',
  unlockWaiting: 'unlockwaiting',
  unlockNfcTagged: 'unlocknfctagged',
  unlocked: 'unlocked',
} as const;

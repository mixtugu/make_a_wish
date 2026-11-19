/** 지원 언어: 일본어·영어 (한국어·중국어는 2026-11 수정 요청으로 제외) */
export type AppLanguage = 'ja' | 'en';

/** 첫 화면 언어 전환 버튼의 표시 순서 */
export const LANGUAGES: AppLanguage[] = ['ja', 'en'];

export type Nationality = 'japanese' | 'foreignResident';

export type Localized = Record<AppLanguage, string>;

export const LANGUAGE_META: Record<AppLanguage, { short: string; title: string }> = {
  ja: { short: '日本語', title: '日本語' },
  en: { short: 'EN', title: 'English' },
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'ja' || value === 'en';
}

/**
 * 화면에 실제로 쓰는 언어.
 * 언어(lang)와 사용자 유형(nationality)은 따로 관리하고, 일본인을 고르면 첫 화면에서 고른 언어와
 * 상관없이 일본어로 표시합니다. 외국인은 첫 화면에서 고른 언어를 그대로 씁니다.
 */
export function displayLanguage(lang: AppLanguage, nationality: Nationality | null): AppLanguage {
  return nationality === 'japanese' ? 'ja' : lang;
}

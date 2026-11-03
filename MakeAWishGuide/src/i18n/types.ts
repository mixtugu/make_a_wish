export type AppLanguage = 'ja' | 'en' | 'ko' | 'zh';

/** 원본 LanguageChooseView 의 표시 순서 */
export const LANGUAGES: AppLanguage[] = ['ja', 'en', 'ko', 'zh'];

export type Nationality = 'japanese' | 'foreignResident';

export type Localized = Record<AppLanguage, string>;

export const LANGUAGE_META: Record<AppLanguage, { flag: string; title: string }> = {
  ko: { flag: '한', title: '한국어' },
  en: { flag: 'EN', title: 'English' },
  ja: { flag: '日', title: '日本語' },
  zh: { flag: '中', title: '中文' },
};

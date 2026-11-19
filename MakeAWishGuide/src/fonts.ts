import { loadAsync } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { GuideMode } from './config/defaults';
import type { AppLanguage } from './i18n/types';

/**
 * 원본 FontManager.swift 의 언어별 (primary, secondary) 폰트 세트 (일본어·영어).
 * - en: Afacad / Chalkduster
 * - ja: Zen Kaku Gothic New / Yuji Syuku
 * (한국어·중국어 폰트 파일은 assets/fonts 에 남아 있지만 더 이상 불러오지 않음)
 */
const CHALKDUSTER = 'Chalkduster';

// Chalkduster 는 iOS 시스템 폰트라 iOS 에서는 따로 로드하지 않습니다(중복 등록 오류 방지).
const chalkdusterSource =
  Platform.OS === 'ios' ? {} : { [CHALKDUSTER]: require('../assets/fonts/Chalkduster.ttf') };

const IPAD_FONTS = {
  Afacad: require('../assets/fonts/Afacad-VariableFont_wght.ttf'),
  'YujiSyuku-Regular': require('../assets/fonts/YujiSyuku-Regular.ttf'),
  'ZenKakuGothicNew-Regular': require('../assets/fonts/ZenKakuGothicNew-Regular.ttf'),
  ...chalkdusterSource,
};

const IPHONE_FONTS = { ...chalkdusterSource };

const FONT_PAIRS: Record<AppLanguage, { primary: string | undefined; secondary: string }> = {
  en: { primary: 'Afacad', secondary: CHALKDUSTER },
  ja: { primary: 'ZenKakuGothicNew-Regular', secondary: 'YujiSyuku-Regular' },
};

let loadFailed = false;

/** 언어별 폰트 이름. 폰트 로드에 실패했다면 시스템 폰트(undefined)로 대체 */
export function fontFor(lang: AppLanguage, secondary = false): string | undefined {
  if (loadFailed) return undefined;
  const pair = FONT_PAIRS[lang];
  return secondary ? pair.secondary : pair.primary;
}

export const chalkduster = CHALKDUSTER;

/**
 * 선택된 모드에 필요한 폰트만 로드합니다. (iPhone 모드는 대용량 다국어 폰트가 필요 없음)
 * 실패해도 앱은 시스템 폰트로 계속 동작합니다.
 */
export function useGuideFonts(mode: GuideMode | null): boolean {
  // 폰트 로드가 끝난 모드. 모드가 바뀌면 새 모드의 로드가 끝날 때까지 false
  const [loadedMode, setLoadedMode] = useState<GuideMode | null>(null);

  useEffect(() => {
    if (!mode) return;
    let alive = true;
    const map = mode === 'ipad' ? IPAD_FONTS : IPHONE_FONTS;
    const job = Object.keys(map).length ? loadAsync(map) : Promise.resolve();
    job
      .catch((e) => {
        loadFailed = true;
        console.warn('[fonts] 폰트 로드 실패 – 시스템 폰트로 대체합니다.', e);
      })
      .finally(() => {
        if (alive) setLoadedMode(mode);
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  return mode !== null && loadedMode === mode;
}

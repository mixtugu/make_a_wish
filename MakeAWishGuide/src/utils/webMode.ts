import { Platform } from 'react-native';

import type { GuideMode } from '../config/defaults';

/**
 * 브라우저 테스트용: 주소의 ?mode=ipad / ?mode=iphone 로 창마다 모드를 정합니다.
 * (같은 브라우저의 창들은 설정 저장소를 함께 쓰므로, 설정의 모드 대신 주소를 따름)
 * 앱(iPhone/iPad)에서는 항상 null.
 */
export function webModeOverride(): GuideMode | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const mode = new URLSearchParams(window.location.search).get('mode');
  return mode === 'ipad' || mode === 'iphone' ? mode : null;
}

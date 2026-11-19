import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { STATUS } from '../../config/defaults';
import { useApi } from '../../hooks/useApi';
import { displayLanguage } from '../../i18n/types';
import { insertStatus } from '../../services/wishFlow';
import { useSettings } from '../../settings/SettingsContext';
import { colors } from '../../theme';
import { log } from '../../utils/log';
import { nextStep } from './flow';
import { AttachScreen } from './screens/AttachScreen';
import { DrawWishScreen } from './screens/DrawWishScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { NationalityScreen } from './screens/NationalityScreen';
import { RemoveTouchScreen } from './screens/RemoveTouchScreen';
import { SavedNextScreen } from './screens/SavedNextScreen';
import { ThankScreen } from './screens/ThankScreen';
import { UnlockedScreen } from './screens/UnlockedScreen';
import { WishSavedScreen } from './screens/WishSavedScreen';
import type { IPadScreenProps, IPadSession, IPadStep } from './types';

export const SCREENS: Record<IPadStep, ComponentType<IPadScreenProps>> = {
  language: LanguageScreen,
  nationality: NationalityScreen,
  draw: DrawWishScreen,
  savedNext: SavedNextScreen,
  attach: AttachScreen,
  wishSaved: WishSavedScreen,
  removeTouch: RemoveTouchScreen,
  unlocked: UnlockedScreen,
  thank: ThankScreen,
};

/**
 * iPad 가이드 (원본 LanguageChooseView → … → ThankView 의 fullScreenCover 체인).
 * 뒤로 가기 없는 일방향 키오스크 흐름이라 단순한 상태 머신으로 구성했습니다.
 * 화면 순서는 사용자 유형(일본인 / 외국인)에 따라 다릅니다 – flow.ts
 */
export function IPadGuide() {
  const { settings } = useSettings();
  const db = useApi();

  // 매 방문은 기본 언어(일본어)로 시작
  const freshSession = useCallback(
    (): IPadSession => ({ lang: settings.defaultLanguage, nationality: null, drawing: null }),
    [settings.defaultLanguage],
  );

  const [step, setStep] = useState<IPadStep>('language');
  // session.lang = 첫 화면에서 고른 언어 (사용자 유형과 별도로 보관)
  const [session, setSession] = useState<IPadSession>(freshSession);
  const [opacity] = useState(() => new Animated.Value(1));
  const navigating = useRef(false);

  const go = useCallback(
    (target: IPadStep) => {
      navigating.current = false;
      opacity.setValue(0);
      setStep(target);
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    },
    [opacity],
  );

  /** 사용자 유형별 순서에 따라 다음 화면으로 (연타해도 한 번만) */
  const next = useCallback(async () => {
    if (navigating.current) return;
    navigating.current = true;
    const target = nextStep(step, session.nationality);
    if (target === 'removeTouch') {
      // 해제 단계 시작: iPhone 을 "fulfill someone's wish" 화면으로 (원본 WishSavedView 의 동작)
      try {
        await insertStatus(db, STATUS.unlockWaiting);
      } catch (e) {
        log('ipad', 'unlockwaiting insert 실패', e); // 원본과 동일: 실패해도 진행
      }
    }
    go(target);
  }, [db, go, step, session.nationality]);

  const update = useCallback((patch: Partial<IPadSession>) => {
    setSession((prev) => ({ ...prev, ...patch }));
  }, []);

  const restart = useCallback(() => {
    setSession(freshSession());
    go('language');
  }, [freshSession, go]);

  // 대기 시간 초과 시 처음으로 (설정에서 켠 경우만)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (settings.idleResetSeconds > 0 && step !== 'language') {
      idleTimer.current = setTimeout(restart, settings.idleResetSeconds * 1000);
    }
  }, [settings.idleResetSeconds, step, restart]);

  useEffect(() => {
    bumpIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [bumpIdle]);

  const Screen = SCREENS[step];
  // 화면에는 사용자 유형을 반영한 표시 언어를 넘김 (일본인 → 일본어 고정)
  const view = useMemo(
    () => ({ ...session, lang: displayLanguage(session.lang, session.nationality) }),
    [session],
  );

  return (
    <View
      style={styles.root}
      // 터치가 있을 때마다 대기 타이머 갱신 (응답자는 가로채지 않음)
      onStartShouldSetResponderCapture={() => {
        bumpIdle();
        return false;
      }}
    >
      <Animated.View style={[styles.root, { opacity }]}>
        <Screen key={step} session={view} update={update} next={next} restart={restart} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});

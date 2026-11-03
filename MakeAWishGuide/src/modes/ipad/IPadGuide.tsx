import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useSettings } from '../../settings/SettingsContext';
import { colors } from '../../theme';
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

const SCREENS: Record<IPadStep, ComponentType<IPadScreenProps>> = {
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
 */
export function IPadGuide() {
  const { settings, lastLanguage } = useSettings();

  const freshSession = useCallback(
    (): IPadSession => ({
      lang: settings.rememberLastLanguage && lastLanguage ? lastLanguage : settings.defaultLanguage,
      nationality: null,
      drawing: null,
    }),
    [settings.rememberLastLanguage, settings.defaultLanguage, lastLanguage],
  );

  const [step, setStep] = useState<IPadStep>('language');
  const [session, setSession] = useState<IPadSession>(freshSession);
  const [opacity] = useState(() => new Animated.Value(1));

  const go = useCallback(
    (next: IPadStep) => {
      opacity.setValue(0);
      setStep(next);
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    },
    [opacity],
  );

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
        <Screen key={step} session={session} update={update} go={go} restart={restart} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});

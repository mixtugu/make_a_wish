import { useEffect, useEffectEvent, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { STATUS } from '../../../config/defaults';
import { useApi } from '../../../hooks/useApi';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { useCurrentStatus } from '../../../live/LiveCurrent';
import { transferUnlockToUnlocked } from '../../../services/wishFlow';
import { colors, IPAD_DESIGN } from '../../../theme';
import { log } from '../../../utils/log';
import type { IPadScreenProps } from '../types';

const UNLOCK_TAGGED = [STATUS.unlockNfcTagged] as const;

/**
 * 원본 RemoveTouchView
 * 다른 색의 소원 종이를 떼어 iPhone 에 태그(status=unlocknfctagged)하면
 * lockeddata → unlockeddata 이관 후 다음 화면으로.
 */
export function RemoveTouchScreen({ session, go }: IPadScreenProps) {
  const { scale: sc, s, height } = useScale(IPAD_DESIGN);
  const insets = useSafeAreaInsets();
  const db = useApi();
  const { lang, nationality } = session;
  const handled = useRef(false);
  const tagged = useCurrentStatus(UNLOCK_TAGGED);

  const onTagged = useEffectEvent(async () => {
    if (handled.current) return;
    handled.current = true;
    log('removeTouch', 'unlocknfctagged 감지 → unlockeddata 로 이관');
    try {
      await transferUnlockToUnlocked(db);
    } catch (e) {
      log('removeTouch', '이관 실패', e);
    }
    go('unlocked');
  });

  useEffect(() => {
    if (tagged) onTagged();
  }, [tagged]);

  const image =
    nationality === 'japanese'
      ? 'stringtouchj'
      : nationality === 'foreignResident'
        ? 'stringtouchf'
        : 'stringtouch';
  const contentHeight = height - insets.top - insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 왼쪽(iPhone 방향)을 가리키는 화살표 */}
      <View style={[styles.arrow, { paddingLeft: sc(12), transform: [{ translateY: sc(80) }] }]} pointerEvents="none">
        <SvgAsset name="direct1" width={sc(100)} />
      </View>

      <View style={[styles.column, { gap: sc(24) }]}>
        <SvgAsset name={image} height={contentHeight * 0.66} />
        <AppText
          lang={lang}
          size={sc(28)}
          secondary
          align="left"
          lineSpacing={sc(18)}
          style={{ paddingHorizontal: sc(32) }}
        >
          {strings.removeTouch.message[lang]}
        </AppText>
      </View>

      <View style={styles.footer} pointerEvents="none">
        <Footer scale={s} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  arrow: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'flex-start' },
  column: { flex: 1, alignItems: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

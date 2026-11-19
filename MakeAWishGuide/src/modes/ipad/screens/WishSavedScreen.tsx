import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

/**
 * 원본 WishSavedView: 탭하면 다음 화면
 * (외국인 → 해제 단계: 이때 currentdata 에 unlockwaiting 추가는 IPadGuide.next 가 처리 / 일본인 → 감사 화면)
 */
export function WishSavedScreen({ session, next }: IPadScreenProps) {
  const { scale: sc, s } = useScale(IPAD_DESIGN);
  const { lang } = session;
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    await next();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.column, { gap: sc(60) }]}>
        <View style={{ flex: 1 }} />
        <AppText lang={lang} size={sc(38)} secondary lineSpacing={sc(18)} style={{ paddingHorizontal: sc(40) }}>
          {strings.wishSaved.message[lang]}
        </AppText>

        {/* 원본: 원형 touch 아이콘 뒤에 "Tap to Continue" 글자, offset y 400 */}
        <Pressable
          onPress={onContinue}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={strings.wishSaved.continue[lang]}
          style={({ pressed }) => [
            styles.touch,
            { transform: [{ translateY: sc(400) }], opacity: pressed || busy ? 0.6 : 1 },
          ]}
        >
          <AppText
            lang={lang}
            size={sc(40)}
            color="rgba(0,0,0,0.7)"
            numberOfLines={1}
            style={{ letterSpacing: 4, position: 'absolute', width: sc(600) }}
          >
            {strings.wishSaved.continue[lang]}
          </AppText>
          <SvgAsset name="touch" width={sc(140)} style={styles.shadow} />
        </Pressable>

        <View style={{ flex: 1 }} />
      </View>
      <View style={styles.footer} pointerEvents="none">
        <Footer scale={s} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  column: { flex: 1, alignItems: 'center' },
  touch: { alignItems: 'center', justifyContent: 'center' },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

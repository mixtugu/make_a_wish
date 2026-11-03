import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

/** 원본 AttachFortuneView: 소원 종이를 앞의 끈에 묶도록 안내 */
export function AttachScreen({ session, go }: IPadScreenProps) {
  const { scale: sc, s, width } = useScale(IPAD_DESIGN);
  const { lang } = session;

  return (
    <View style={styles.root}>
      <View style={[styles.column, { gap: sc(40) }]}>
        <View style={{ height: sc(160) - sc(40) }} />
        <View style={styles.imageWrap}>
          <SvgAsset name="string" width={Math.min(width, sc(834)) / 1.5} style={{ transform: [{ scale: 1.5 }] }} />
        </View>
        <AppText
          lang={lang}
          size={sc(30)}
          secondary
          lineSpacing={sc(18)}
          color="rgba(0,0,0,0.8)"
          style={{ paddingHorizontal: sc(40), paddingTop: sc(80) }}
        >
          {strings.attach.description[lang]}
        </AppText>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => go('wishSaved')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            {
              width: sc(200),
              height: sc(80),
              borderRadius: sc(40),
              marginBottom: sc(40) + sc(52),
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <AppText lang={lang} size={sc(28)} color={colors.white}>
            {strings.attach.next[lang]}
          </AppText>
        </Pressable>
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
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: colors.gray, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

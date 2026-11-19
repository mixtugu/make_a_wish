import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/AppText';
import { SvgAsset } from '../../../components/SvgAsset';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

/** 원본 UnlockedView: 아무 곳이나 탭하면 감사 화면 */
export function UnlockedScreen({ session, next }: IPadScreenProps) {
  const { scale: sc } = useScale(IPAD_DESIGN);
  const { lang } = session;

  return (
    <Pressable style={styles.root} onPress={next} accessibilityRole="button">
      <View style={styles.center} pointerEvents="none">
        <SvgAsset name="ema3" width={sc(550)} style={{ transform: [{ translateY: -sc(80) }] }} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText
            lang={lang}
            size={sc(44)}
            secondary
            style={{ paddingHorizontal: sc(32), paddingVertical: sc(24) }}
          >
            {strings.unlocked.message[lang]}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

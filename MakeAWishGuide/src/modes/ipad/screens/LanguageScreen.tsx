import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { LANGUAGE_META, LANGUAGES, type AppLanguage } from '../../../i18n/types';
import { useSettings } from '../../../settings/SettingsContext';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

/** 원본 LanguageChooseView – 소개 화면. 오른쪽 위의 작은 버튼으로 일본어 / 영어 전환 (이 화면에서만) */
export function LanguageScreen({ session, update, next }: IPadScreenProps) {
  const { scale: sc, s } = useScale(IPAD_DESIGN);
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const lang = session.lang;
  // ⚙︎ 관리 버튼(44pt, 오른쪽 위 12pt)이 보이면 그 왼쪽에 둠
  const toggleRight = insets.right + (settings.showSettingsButton ? 12 + 44 + 10 : sc(20));

  return (
    <View style={[styles.root, { paddingTop: insets.top + sc(16) }]}>
      <LanguageToggle
        lang={lang}
        s={s}
        onChange={(l) => update({ lang: l })}
        style={{ top: insets.top + 12, right: toggleRight }}
      />
      <View style={styles.spacer} />
      <View style={[styles.row, { marginBottom: sc(50), paddingHorizontal: sc(16) }]}>
        {/* 원본 infoSection */}
        <View style={[styles.info, { gap: sc(16) }]}>
          <AppText lang={lang} size={sc(28)} weight="700" lineSpacing={sc(10)}>
            {strings.language.infoTop[lang]}
          </AppText>
          <Image
            source={require('../../../../assets/images/first.png')}
            style={{ width: sc(480), height: sc(480), margin: sc(16), borderRadius: sc(14) }}
            resizeMode="contain"
          />
          <AppText lang={lang} size={sc(22)} secondary style={{ paddingTop: sc(30) }}>
            {strings.language.infoBottom[lang]}
          </AppText>
        </View>
      </View>
      <Pressable
        onPress={next}
        style={({ pressed }) => [
          styles.button,
          { width: sc(240), height: sc(50), opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="button"
      >
        <AppText lang={lang} size={sc(20)} weight="600" color={colors.white}>
          {strings.language.start[lang]}
        </AppText>
      </Pressable>
      <View style={{ height: sc(80) }} />
      <Footer scale={s} />
    </View>
  );
}

/** 「日本語 / EN」 작은 전환 버튼 */
function LanguageToggle({
  lang,
  s,
  onChange,
  style,
}: {
  lang: AppLanguage;
  s: number;
  onChange: (lang: AppLanguage) => void;
  style: StyleProp<ViewStyle>;
}) {
  const size = Math.max(0.85, Math.min(s, 1.2));
  return (
    <View
      style={[styles.toggle, { height: 40 * size, borderRadius: 20 * size, padding: 3 * size }, style]}
      accessibilityRole="radiogroup"
    >
      {LANGUAGES.map((l) => {
        const selected = l === lang;
        return (
          <Pressable
            key={l}
            onPress={() => onChange(l)}
            hitSlop={6}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={LANGUAGE_META[l].title}
            style={[
              styles.toggleItem,
              {
                borderRadius: 17 * size,
                paddingHorizontal: 14 * size,
                backgroundColor: selected ? colors.brown : 'transparent',
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 15 * size,
                fontWeight: selected ? '700' : '500',
                color: selected ? colors.white : colors.brown,
              }}
            >
              {LANGUAGE_META[l].short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  spacer: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  info: { flex: 1, alignItems: 'center' },
  button: {
    backgroundColor: colors.brown,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    position: 'absolute',
    zIndex: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(124,102,66,0.45)',
  },
  toggleItem: { justifyContent: 'center', alignItems: 'center' },
});

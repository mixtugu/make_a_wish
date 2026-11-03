import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { LANGUAGE_META, LANGUAGES, type AppLanguage } from '../../../i18n/types';
import { useSettings } from '../../../settings/SettingsContext';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

/** 원본 LanguageChooseView */
export function LanguageScreen({ session, update, go }: IPadScreenProps) {
  const { scale: sc, s } = useScale(IPAD_DESIGN);
  const insets = useSafeAreaInsets();
  const { setLastLanguage } = useSettings();
  const lang = session.lang;
  const sideWidth = sc(80) + sc(32);

  const onContinue = () => {
    setLastLanguage(lang);
    go('nationality');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + sc(16) }]}>
      <View style={styles.spacer} />
      <View style={[styles.row, { marginBottom: sc(50), paddingHorizontal: sc(16) }]}>
        <View style={{ width: sideWidth, gap: sc(12) }}>
          {LANGUAGES.map((l) => (
            <LanguageButton
              key={l}
              lang={l}
              selected={l === lang}
              s={s}
              onPress={() => update({ lang: l })}
            />
          ))}
        </View>
        {/* 원본 infoSection (offset x: -70 → 좌우 대칭이 되도록 오른쪽 여백) */}
        <View style={[styles.info, { gap: sc(16), paddingRight: sideWidth }]}>
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
        onPress={onContinue}
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

function LanguageButton({
  lang,
  selected,
  s,
  onPress,
}: {
  lang: AppLanguage;
  selected: boolean;
  s: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={LANGUAGE_META[lang].title}
      style={[
        styles.langButton,
        {
          width: 80 * s,
          paddingVertical: 16 * s,
          borderRadius: 14 * s,
          borderColor: selected ? colors.accent : 'rgba(60,60,67,0.35)',
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <Text allowFontScaling={false} style={{ fontSize: 34 * s, color: colors.black }}>
        {LANGUAGE_META[lang].flag}
      </Text>
    </Pressable>
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
  langButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

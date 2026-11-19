import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import type { Nationality } from '../../../i18n/types';
import { colors, IPAD_DESIGN } from '../../../theme';
import type { IPadScreenProps } from '../types';

const OPTIONS: Nationality[] = ['japanese', 'foreignResident'];

/** 원본 NationalityChooseView (SwiftUI .offset 은 레이아웃에 영향을 주지 않는 translate 로 동일하게 재현) */
export function NationalityScreen({ session, update, next }: IPadScreenProps) {
  const { scale: sc, s, width } = useScale(IPAD_DESIGN);
  const insets = useSafeAreaInsets();
  const { lang, nationality } = session;
  const t = strings.nationality;

  return (
    <View style={[styles.root, { paddingHorizontal: sc(20), paddingTop: insets.top, gap: sc(16) }]}>
      <AppText
        lang={lang}
        size={sc(34)}
        weight="600"
        style={{ paddingTop: sc(70), paddingBottom: sc(40) - sc(16) }}
      >
        {t.title[lang]}
      </AppText>

      <SvgAsset
        name="intro"
        width={width - sc(40)}
        style={{ transform: [{ scale: 1.1 }], marginVertical: sc(4) }}
      />

      <AppText
        lang={lang}
        size={sc(28)}
        lineSpacing={sc(10)}
        style={{ maxWidth: sc(600), paddingHorizontal: sc(16), transform: [{ translateY: -sc(180) }] }}
      >
        {t.description[lang]}
      </AppText>

      <AppText
        lang={lang}
        size={sc(30)}
        secondary
        weight="600"
        style={{ paddingHorizontal: sc(16), transform: [{ translateY: -sc(60) }] }}
      >
        {t.choose[lang]}
      </AppText>

      <View style={{ gap: sc(12), width: '100%', maxWidth: sc(520) }}>
        {OPTIONS.map((opt) => {
          const selected = nationality === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => update({ nationality: opt })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.option,
                {
                  paddingVertical: sc(14),
                  paddingHorizontal: sc(16),
                  borderRadius: sc(12),
                  backgroundColor: selected ? 'rgba(0,122,255,0.15)' : 'rgba(142,142,147,0.08)',
                  borderColor: selected ? colors.accent : 'rgba(142,142,147,0.3)',
                },
              ]}
            >
              <AppText lang={lang} size={sc(17)} align="left" style={{ flex: 1 }}>
                {t[opt][lang]}
              </AppText>
              <RadioMark selected={selected} size={sc(24)} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        disabled={!nationality}
        onPress={next}
        accessibilityRole="button"
        accessibilityState={{ disabled: !nationality }}
        style={({ pressed }) => [
          styles.next,
          {
            maxWidth: sc(480),
            minHeight: sc(55),
            borderRadius: sc(12),
            marginTop: sc(20),
            backgroundColor: nationality ? colors.accent : 'rgba(142,142,147,0.3)',
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <AppText
          lang={lang}
          size={sc(18)}
          weight="600"
          color={nationality ? colors.white : 'rgba(0,0,0,0.6)'}
        >
          {nationality ? t.next[lang] : t.selectToContinue[lang]}
        </AppText>
      </Pressable>

      <View style={{ flex: 1, minHeight: sc(12) }} />
      <Footer scale={s} />
    </View>
  );
}

function RadioMark({ selected, size }: { selected: boolean; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: selected ? colors.accent : colors.black,
        backgroundColor: selected ? colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected && (
        <Text allowFontScaling={false} style={{ color: colors.white, fontSize: size * 0.6, fontWeight: '700' }}>
          ✓
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  next: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});

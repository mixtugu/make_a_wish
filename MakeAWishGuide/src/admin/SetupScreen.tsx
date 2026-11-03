import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GuideMode } from '../config/defaults';
import { useSettings } from '../settings/SettingsContext';
import { colors } from '../theme';

const OPTIONS: { mode: GuideMode; title: string; device: string; desc: string }[] = [
  {
    mode: 'iphone',
    title: 'iPhone guide',
    device: 'NFC prompt screen',
    desc: 'Shows the "Make a Wish" screen while idle, and asks visitors to hold their wish paper to the phone once a wish is saved on the iPad.',
  },
  {
    mode: 'ipad',
    title: 'iPad guide',
    device: 'Wish-writing kiosk',
    desc: "Runs the full experience: choose language → choose visitor type → draw a wish → tag → untie someone else's wish.",
  },
];

/** 최초 실행 시 이 기기를 어떤 가이드로 쓸지 선택 */
export function SetupScreen() {
  const { update, isTabletDevice } = useSettings();
  const insets = useSafeAreaInsets();
  const recommended: GuideMode = isTabletDevice ? 'ipad' : 'iphone';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>Make a Wish</Text>
      <Text style={styles.subtitle}>Which guide should this device run?</Text>

      <View style={styles.cards}>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.mode}
            onPress={() => update({ mode: o.mode, setupDone: true })}
            style={({ pressed }) => [
              styles.card,
              o.mode === recommended && styles.cardRecommended,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
          >
            {o.mode === recommended && <Text style={styles.badge}>Recommended for this device</Text>}
            <Text style={styles.cardTitle}>{o.title}</Text>
            <Text style={styles.cardDevice}>{o.device}</Text>
            <Text style={styles.cardDesc}>{o.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        To change this later, tap the <Text style={{ fontWeight: '700' }}>⚙︎ button in the top-right corner</Text>{' '}
        (or long-press that corner for 2 seconds if the button is hidden) and choose a guide.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { alignItems: 'center', paddingHorizontal: 24, gap: 16 },
  // 이 시점엔 커스텀 폰트를 아직 로드하지 않았으므로 iOS 시스템 폰트만 사용
  title: { fontSize: 40, color: colors.black, fontFamily: Platform.OS === 'ios' ? 'Chalkduster' : undefined },
  subtitle: { fontSize: 20, color: colors.black, marginBottom: 16 },
  cards: { width: '100%', maxWidth: 720, gap: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 20,
    padding: 24,
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardRecommended: { borderColor: colors.brown },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brown,
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 24, fontWeight: '700', color: colors.black },
  cardDevice: { fontSize: 15, color: colors.brown, fontWeight: '600' },
  cardDesc: { fontSize: 15, color: '#333', lineHeight: 22, marginTop: 6 },
  note: { fontSize: 14, color: '#5a4a30', textAlign: 'center', marginTop: 16, maxWidth: 520, lineHeight: 21 },
});

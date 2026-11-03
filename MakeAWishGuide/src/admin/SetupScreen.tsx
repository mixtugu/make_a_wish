import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GuideMode } from '../config/defaults';
import { useSettings } from '../settings/SettingsContext';
import { colors } from '../theme';

const OPTIONS: { mode: GuideMode; title: string; device: string; desc: string }[] = [
  {
    mode: 'iphone',
    title: 'iPhone 가이드',
    device: 'NFC 안내 화면',
    desc: '대기 중엔 "Make a Wish" 화면을 띄우고, iPad 에서 소원을 저장하면 소원 종이를 대도록 안내합니다.',
  },
  {
    mode: 'ipad',
    title: 'iPad 가이드',
    device: '소원 작성 키오스크',
    desc: '언어 선택 → 신분 선택 → 소원 그리기 → 태그 → 다른 사람의 소원 풀기까지 전체 체험을 진행합니다.',
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
      <Text style={styles.subtitle}>이 기기를 어떤 가이드로 사용할까요?</Text>

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
            {o.mode === recommended && <Text style={styles.badge}>이 기기에 추천</Text>}
            <Text style={styles.cardTitle}>{o.title}</Text>
            <Text style={styles.cardDevice}>{o.device}</Text>
            <Text style={styles.cardDesc}>{o.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        나중에 바꾸려면 화면 <Text style={{ fontWeight: '700' }}>오른쪽 위 모서리를 2초간 길게</Text> 눌러 관리자
        메뉴 → 설정을 여세요.
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

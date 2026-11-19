import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useApi } from '../hooks/useApi';
import type { CardColor } from '../modes/ipad/flow';
import { useSettings } from '../settings/SettingsContext';
import { CARD_COLORS, markRecorded, markReleased, useRecordedCards, VIRTUAL_CARDS } from './testCards';

interface Props {
  /** 이 화면이 기다리는 동작 (안내 문구용) */
  kind: 'record' | 'release';
  /** 이 단계에서 써야 하는 카드 색 (없으면 강조 없음 – iPhone 화면) */
  expected?: CardColor;
  style?: StyleProp<ViewStyle>;
}

const KIND_LABEL = {
  record: 'Record a wish: touch a card',
  release: 'Release a wish: touch a card that has a wish',
};

/**
 * 테스트 모드 전용: NFC 태그 대신 누르는 가상 카드 버튼.
 * 실제 태그(단축어 / 앱 NFC)와 똑같이 POST /api/tag 를 보내므로 이후 처리는 실제와 같습니다.
 * 설정에서 테스트 모드를 켠 경우에만 보입니다.
 */
export function TestTagPanel({ kind, expected, style }: Props) {
  const { settings } = useSettings();
  const api = useApi();
  const recorded = useRecordedCards();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!settings.testMode) return null;

  const touch = async (id: string, label: string) => {
    if (busy) return;
    setBusy(id);
    setResult(null);
    try {
      const { updated, to } = await api.tag(id);
      if (updated > 0) {
        if (to === 'nfctagged') markRecorded(id);
        if (to === 'unlocknfctagged') markReleased(id);
        setResult({ ok: true, text: `${label} touched → ${to}` });
      } else {
        setResult({ ok: false, text: 'Nothing is waiting for a touch right now.' });
      }
    } catch (e) {
      setResult({ ok: false, text: `Server error: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  const releaseWithoutWish =
    kind === 'release' && !VIRTUAL_CARDS.some((c) => recorded.has(c.id) && (!expected || c.color === expected));

  return (
    <View style={[styles.panel, style]} pointerEvents="box-none">
      <Text style={styles.title}>TEST MODE · {KIND_LABEL[kind]}</Text>
      <View style={styles.row}>
        {VIRTUAL_CARDS.map((card) => {
          const dim = expected !== undefined && card.color !== expected;
          const hasWish = recorded.has(card.id);
          const c = CARD_COLORS[card.color];
          return (
            <Pressable
              key={card.id}
              onPress={() => touch(card.id, card.label)}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={`Simulate touching ${card.label}`}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: c.fill, opacity: dim ? 0.35 : pressed || busy === card.id ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.cardText, { color: c.text }]}>{card.label}</Text>
              <Text style={[styles.cardSub, { color: c.text }]}>{hasWish ? '✓ wish' : ' '}</Text>
            </Pressable>
          );
        })}
      </View>
      {expected && (
        <Text style={styles.hint}>
          This step uses a {expected} card.
          {releaseWithoutWish && ' No wish is recorded on this device’s test cards yet – the release will find nothing.'}
        </Text>
      )}
      {result && <Text style={[styles.result, { color: result.ok ? '#9BE59B' : '#FFB4A8' }]}>{result.text}</Text>}
    </View>
  );
}

/** 테스트 모드가 켜져 있음을 화면 구석에 항상 표시 (전시 중 켜 둔 채로 두지 않도록) */
export function TestModeBadge() {
  const { settings } = useSettings();
  if (!settings.testMode) return null;
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.badgeText}>TEST MODE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
    backgroundColor: 'rgba(30,30,30,0.86)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  cardText: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  hint: { color: '#DDDDDD', fontSize: 12, lineHeight: 16 },
  result: { fontSize: 13, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 200,
    backgroundColor: '#D7263D',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});

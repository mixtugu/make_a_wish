import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STATUS } from '../config/defaults';
import { displayLanguage, type AppLanguage, type Nationality } from '../i18n/types';
import { FLOWS } from '../modes/ipad/flow';
import { SCREENS } from '../modes/ipad/IPadGuide';
import type { IPadSession, IPadStep } from '../modes/ipad/types';
import { IdleScreen, NfcScreen } from '../modes/iphone/IPhoneGuide';
import { colors } from '../theme';

/**
 * 화면 미리보기: 서버·NFC 없이 각 화면의 모양만 차례로 넘겨 봅니다.
 * 미리보기 중에는 서버 요청(상태 기록, 그림 업로드, currentdata 정리)과 태그 반응을 하지 않으므로
 * 데이터가 남지 않습니다. 화면 안의 버튼(다음, 카드 그림 등)을 눌러도 다음 화면으로 넘어갑니다.
 */
type Target =
  | { device: 'ipad'; nationality: Nationality; lang: AppLanguage; label: string }
  | { device: 'iphone'; label: string };

const TARGETS: Target[] = [
  { device: 'ipad', nationality: 'foreignResident', lang: 'ja', label: 'iPad · 外国人 · 日本語' },
  { device: 'ipad', nationality: 'foreignResident', lang: 'en', label: 'iPad · Foreigner · English' },
  { device: 'ipad', nationality: 'japanese', lang: 'ja', label: 'iPad · 日本人 · 日本語' },
  { device: 'iphone', label: 'iPhone' },
];

const STEP_LABEL: Record<IPadStep, string> = {
  language: 'Intro / language',
  nationality: 'Choose identity',
  draw: 'Write a wish',
  savedNext: 'Record: touch card on phone',
  attach: 'Attach to string',
  wishSaved: 'Wish saved',
  removeTouch: 'Release: pick card, touch phone',
  unlocked: 'Wish released',
  thank: 'Thank you',
};

const IPHONE_STEPS = [
  { key: 'idle', label: 'Idle (Make a Wish)' },
  { key: STATUS.waiting, label: 'Record: make a wish' },
  { key: STATUS.unlockWaiting, label: "Release: fulfill someone's wish" },
] as const;

export function ScreenPreview({ onClose }: { onClose: () => void }) {
  const [target, setTarget] = useState<Target | null>(null);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait']}>
      {target ? (
        <Viewer key={target.label} target={target} onBack={() => setTarget(null)} />
      ) : (
        <Chooser onPick={setTarget} onClose={onClose} />
      )}
    </Modal>
  );
}

function Chooser({ onPick, onClose }: { onPick: (t: Target) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.chooser}
      contentContainerStyle={[styles.chooserContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>Screen preview</Text>
      <Text style={styles.subtitle}>
        Step through the screens in order without the server or NFC. Nothing is saved.{'\n'}
        Use ◀ ▶ at the bottom, or the buttons on each screen.
      </Text>
      {TARGETS.map((t) => (
        <Pressable
          key={t.label}
          onPress={() => onPick(t)}
          style={({ pressed }) => [styles.choice, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={styles.choiceText}>{t.label}</Text>
          <Text style={styles.choiceHint}>
            {t.device === 'ipad'
              ? FLOWS[t.nationality].map((s) => STEP_LABEL[s]).join(' → ')
              : IPHONE_STEPS.map((s) => s.label).join(' → ')}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={onClose} style={[styles.choice, styles.close]} accessibilityRole="button">
        <Text style={[styles.choiceText, { color: colors.black }]}>Close</Text>
      </Pressable>
    </ScrollView>
  );
}

function Viewer({ target, onBack }: { target: Target; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState<IPadSession>(() => ({
    lang: target.device === 'ipad' ? target.lang : 'ja',
    nationality: target.device === 'ipad' ? target.nationality : null,
    drawing: null,
  }));

  const steps = target.device === 'ipad' ? FLOWS[target.nationality] : null;
  const count = steps ? steps.length : IPHONE_STEPS.length;
  const go = (i: number) => setIndex(Math.max(0, Math.min(count - 1, i)));
  const view = useMemo(
    () => ({ ...session, lang: displayLanguage(session.lang, session.nationality) }),
    [session],
  );

  let content: ReactNode;
  let label: string;
  if (steps) {
    const step = steps[index];
    const Screen = SCREENS[step];
    label = STEP_LABEL[step];
    content = (
      <Screen
        key={`${step}-${index}`}
        session={view}
        update={(patch) => setSession((prev) => ({ ...prev, ...patch }))}
        next={async () => go(index + 1)}
        restart={() => go(0)}
        preview
      />
    );
  } else {
    const step = IPHONE_STEPS[index];
    label = step.label;
    content = step.key === 'idle' ? <IdleScreen /> : <NfcScreen key={step.key} status={step.key} preview />;
  }

  return (
    <View style={styles.viewer}>
      {content}
      <View style={[styles.bar, { bottom: insets.bottom + 12 }]}>
        <BarButton label="✕" onPress={onBack} />
        <BarButton label="◀" onPress={() => go(index - 1)} disabled={index === 0} />
        <View style={styles.barLabel}>
          <Text style={styles.barTitle} numberOfLines={1}>
            {index + 1}/{count} · {label}
          </Text>
          <Text style={styles.barSub} numberOfLines={1}>
            PREVIEW · {target.label}
          </Text>
        </View>
        <BarButton label="▶" onPress={() => go(index + 1)} disabled={index === count - 1} />
      </View>
    </View>
  );
}

function BarButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.barButton, (pressed || disabled) && { opacity: disabled ? 0.3 : 0.6 }]}
      accessibilityRole="button"
    >
      <Text style={styles.barButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chooser: { flex: 1, backgroundColor: '#F2F2F7' },
  chooserContent: { padding: 20, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: 14, color: '#6D6D72', lineHeight: 20, marginBottom: 8 },
  choice: { backgroundColor: colors.brown, borderRadius: 12, padding: 16, gap: 6 },
  choiceText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  choiceHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },
  close: { backgroundColor: '#E5E5EA', alignItems: 'center' },
  viewer: { flex: 1, backgroundColor: colors.background },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30,30,30,0.85)',
    borderRadius: 16,
    padding: 8,
  },
  barButton: {
    width: 48,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barButtonText: { color: colors.white, fontSize: 20, fontWeight: '700' },
  barLabel: { flex: 1, alignItems: 'center' },
  barTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  barSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
});

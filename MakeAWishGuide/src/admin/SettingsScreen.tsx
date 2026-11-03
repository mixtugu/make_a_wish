import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_SETTINGS, type AppSettings, type GuideModeSetting } from '../config/defaults';
import { LANGUAGE_META, LANGUAGES } from '../i18n/types';
import { ApiError, createApi, normalizeServerUrl } from '../services/api';
import { isNfcAvailable } from '../services/nfc';
import { clearCurrentData } from '../services/wishFlow';
import { useSettings } from '../settings/SettingsContext';
import { colors } from '../theme';

interface Props {
  onClose: () => void;
  /** 저장 직후 호출 */
  onSaved?: () => void;
}

/**
 * 기기별 설정 (iPhone / iPad 모드 전환, 서버, NFC, 전시 옵션)
 * 열려 있는 동안만 마운트되므로 열 때마다 현재 설정으로 초안이 초기화됩니다.
 */
export function SettingsScreen({ onClose, onSaved }: Props) {
  const { settings, update, reset, isTabletDevice } = useSettings();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<AppSettings>(() => settings);
  const [testState, setTestState] = useState<{ busy: boolean; message?: string; ok?: boolean }>({ busy: false });
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    isNfcAvailable().then((ok) => {
      if (alive) setNfcAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const resolved = draft.mode === 'auto' ? (isTabletDevice ? 'ipad' : 'iphone') : draft.mode;
  const db = () => createApi({ url: normalizeServerUrl(draft.serverUrl), token: draft.apiToken.trim() });

  const testConnection = async () => {
    setTestState({ busy: true });
    try {
      const rows = await db().listCurrent();
      setTestState({
        busy: false,
        ok: true,
        message: `연결 성공 · currentdata ${rows.length}건${rows.length ? ` (${rows.map((r) => r.status).join(', ')})` : ''}`,
      });
    } catch (e) {
      let msg = String(e);
      if (e instanceof ApiError) {
        msg = e.status === 401 ? '토큰이 맞지 않습니다 (HTTP 401)' : `${e.message}\n${e.body.slice(0, 200)}`;
      }
      setTestState({ busy: false, ok: false, message: `연결 실패: ${msg}` });
    }
  };

  const confirmClear = () => {
    Alert.alert('currentdata 비우기', '진행 중인 모든 상태(waiting / nfctagged 등)를 삭제합니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearCurrentData(db());
            Alert.alert('완료', 'currentdata 를 비웠습니다.');
          } catch (e) {
            Alert.alert('실패', String(e));
          }
        },
      },
    ]);
  };

  const confirmReset = () => {
    Alert.alert('설정 초기화', '모든 설정을 기본값으로 되돌립니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          await reset();
          onClose();
        },
      },
    ]);
  };

  const save = async () => {
    await update(draft);
    onClose();
    onSaved?.();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.headerAction}>취소</Text>
          </Pressable>
          <Text style={styles.headerTitle}>설정</Text>
          <Pressable onPress={save} hitSlop={12}>
            <Text style={[styles.headerAction, { fontWeight: '700' }]}>저장</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <Section title="가이드 모드" footer={`이 기기는 ${isTabletDevice ? 'iPad' : 'iPhone'} 입니다. 저장하면 바로 ${resolved === 'ipad' ? 'iPad' : 'iPhone'} 가이드로 전환됩니다.`}>
            <Segmented<GuideModeSetting>
              value={draft.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'auto', label: `자동 (${isTabletDevice ? 'iPad' : 'iPhone'})` },
                { value: 'iphone', label: 'iPhone 가이드' },
                { value: 'ipad', label: 'iPad 가이드' },
              ]}
            />
          </Section>

          {resolved === 'ipad' && (
            <Section title="iPad 가이드">
              <Text style={styles.label}>처음 선택되어 있는 언어</Text>
              <Segmented
                value={draft.defaultLanguage}
                onChange={(v) => set('defaultLanguage', v)}
                options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_META[l].title }))}
              />
              <Row label="마지막 방문자의 언어 유지" hint="원본 앱 동작. 끄면 항상 위의 언어로 시작합니다.">
                <Switch value={draft.rememberLastLanguage} onValueChange={(v) => set('rememberLastLanguage', v)} />
              </Row>
              <Row label="입력 없으면 처음으로 (초)" hint="0 = 사용 안 함. 관람객이 중간에 떠난 경우 대비.">
                <NumberInput value={draft.idleResetSeconds} onChange={(v) => set('idleResetSeconds', v)} />
              </Row>
            </Section>
          )}

          {resolved === 'iphone' && (
            <Section
              title="iPhone 가이드"
              footer={
                '끄면(기본) 원본 앱처럼 외부(단축어 자동화 등)가 currentdata 상태를 nfctagged / unlocknfctagged 로 바꿔 준다고 가정합니다.\n' +
                '켜면 NFC 안내 화면에서 앱이 직접 태그 UID 를 읽어 상태와 nfc_id 를 기록합니다.'
              }
            >
              <Row
                label="앱에서 NFC 태그 직접 읽기"
                hint={
                  nfcAvailable === null
                    ? '확인 중…'
                    : nfcAvailable
                      ? '이 기기에서 NFC 사용 가능'
                      : 'NFC 사용 불가 (Expo Go 이거나 NFC 미지원 기기 – 개발 빌드 필요)'
                }
              >
                <Switch value={draft.nfcInAppScan} onValueChange={(v) => set('nfcInAppScan', v)} />
              </Row>
            </Section>
          )}

          <Section title="공통">
            <Row label="화면 꺼짐 방지" hint="전시용으로 켜 두는 것을 권장합니다.">
              <Switch value={draft.keepAwake} onValueChange={(v) => set('keepAwake', v)} />
            </Row>
            <Row label="상태 확인 주기 (ms)" hint="원본: 1500ms · 500~10000">
              <NumberInput value={draft.pollIntervalMs} onChange={(v) => set('pollIntervalMs', v)} />
            </Row>
          </Section>

          <Section title="서버 (Cloudflare)" footer="iPhone 과 iPad 는 반드시 같은 서버 주소와 토큰을 써야 합니다.">
            <Text style={styles.label}>서버 주소</Text>
            <TextInput
              style={styles.input}
              value={draft.serverUrl}
              onChangeText={(v) => set('serverUrl', v)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://make-a-wish-server.xxxx.workers.dev"
            />
            <Text style={styles.label}>API 토큰</Text>
            <TextInput
              style={styles.input}
              value={draft.apiToken}
              onChangeText={(v) => set('apiToken', v)}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.buttonRow}>
              <SmallButton label="연결 테스트" onPress={testConnection} disabled={testState.busy} />
              <SmallButton
                label="기본값으로"
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    serverUrl: DEFAULT_SETTINGS.serverUrl,
                    apiToken: DEFAULT_SETTINGS.apiToken,
                  }))
                }
                subtle
              />
            </View>
            {testState.busy && <ActivityIndicator style={{ marginTop: 8 }} />}
            {testState.message && (
              <Text style={[styles.testResult, { color: testState.ok ? '#1F8A3B' : colors.danger }]}>
                {testState.message}
              </Text>
            )}
          </Section>

          <Section title="관리">
            <View style={styles.buttonRow}>
              <SmallButton label="currentdata 비우기" onPress={confirmClear} danger />
              <SmallButton label="설정 초기화" onPress={confirmReset} subtle />
            </View>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // 입력 중에는 사용자가 친 그대로 보여 주고, 포커스를 잃으면 확정된 값으로 정리
  const [text, setText] = useState(String(value));
  return (
    <TextInput
      style={[styles.input, styles.numberInput]}
      value={text}
      keyboardType="number-pad"
      onChangeText={(v) => {
        setText(v);
        const n = Number(v);
        if (v !== '' && Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function SmallButton({
  label,
  onPress,
  disabled,
  subtle,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  subtle?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.smallButton,
        subtle && { backgroundColor: '#EFEFF4' },
        danger && { backgroundColor: colors.danger },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.smallButtonText, subtle && { color: colors.black }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerAction: { fontSize: 17, color: colors.accent },
  content: { padding: 20, gap: 24, width: '100%', maxWidth: 760, alignSelf: 'center' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, color: '#6D6D72', textTransform: 'uppercase', marginLeft: 4 },
  sectionBody: { backgroundColor: colors.white, borderRadius: 12, padding: 16, gap: 12 },
  sectionFooter: { fontSize: 13, color: '#6D6D72', marginHorizontal: 4, lineHeight: 18 },
  label: { fontSize: 14, color: '#3C3C43', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontSize: 16, color: colors.black },
  rowHint: { fontSize: 12, color: '#6D6D72', marginTop: 2 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C6C6C8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
    color: colors.black,
  },
  numberInput: { width: 100, textAlign: 'right' },
  segmented: { flexDirection: 'row', backgroundColor: '#EFEFF4', borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentText: { fontSize: 14, color: '#3C3C43' },
  segmentTextActive: { fontWeight: '700', color: colors.black },
  buttonRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  smallButton: { backgroundColor: colors.brown, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16 },
  smallButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  testResult: { fontSize: 13, lineHeight: 18 },
});

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
        message: `Connected · currentdata: ${rows.length} row(s)${rows.length ? ` (${rows.map((r) => r.status).join(', ')})` : ''}`,
      });
    } catch (e) {
      let msg = String(e);
      if (e instanceof ApiError) {
        msg = e.status === 401 ? 'Invalid token (HTTP 401)' : `${e.message}\n${e.body.slice(0, 200)}`;
      }
      setTestState({ busy: false, ok: false, message: `Connection failed: ${msg}` });
    }
  };

  const confirmClear = () => {
    Alert.alert('Clear currentdata', 'This deletes every in-progress state (waiting, nfctagged, etc.). Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearCurrentData(db());
            Alert.alert('Done', 'currentdata has been cleared.');
          } catch (e) {
            Alert.alert('Failed', String(e));
          }
        },
      },
    ]);
  };

  const confirmReset = () => {
    Alert.alert('Reset settings', 'All settings will return to their defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
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
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <Pressable onPress={save} hitSlop={12}>
            <Text style={[styles.headerAction, { fontWeight: '700' }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <Section title="Guide mode" footer={`This device is an ${isTabletDevice ? 'iPad' : 'iPhone'}. Saving switches to the ${resolved === 'ipad' ? 'iPad' : 'iPhone'} guide right away.`}>
            <Segmented<GuideModeSetting>
              value={draft.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'auto', label: `Auto (${isTabletDevice ? 'iPad' : 'iPhone'})` },
                { value: 'iphone', label: 'iPhone guide' },
                { value: 'ipad', label: 'iPad guide' },
              ]}
            />
          </Section>

          {resolved === 'ipad' && (
            <Section title="iPad guide">
              <Text style={styles.label}>Default language</Text>
              <Segmented
                value={draft.defaultLanguage}
                onChange={(v) => set('defaultLanguage', v)}
                options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_META[l].title }))}
              />
              <Row label="Keep last visitor's language" hint="Original app behavior. When off, every visit starts in the language above.">
                <Switch value={draft.rememberLastLanguage} onValueChange={(v) => set('rememberLastLanguage', v)} />
              </Row>
              <Row label="Return to start when idle (sec)" hint="0 = off. Useful when a visitor walks away midway.">
                <NumberInput value={draft.idleResetSeconds} onChange={(v) => set('idleResetSeconds', v)} />
              </Row>
            </Section>
          )}

          {resolved === 'iphone' && (
            <Section
              title="iPhone guide"
              footer={
                'Off (default): like the original app, something outside the app (e.g. a Shortcuts automation) changes currentdata to nfctagged / unlocknfctagged.\n' +
                'On: the app reads the tag UID itself on the NFC screen and records the status and nfc_id.'
              }
            >
              <Row
                label="Read NFC tags in the app"
                hint={
                  nfcAvailable === null
                    ? 'Checking…'
                    : nfcAvailable
                      ? 'NFC is available on this device'
                      : 'NFC unavailable (Expo Go or unsupported device – needs a development build)'
                }
              >
                <Switch value={draft.nfcInAppScan} onValueChange={(v) => set('nfcInAppScan', v)} />
              </Row>
            </Section>
          )}

          <Section title="General">
            <Row label="Show settings (⚙︎) button" hint="Recommended off during the exhibition. When off, long-press the top-right corner for 2 seconds to open the menu.">
              <Switch value={draft.showSettingsButton} onValueChange={(v) => set('showSettingsButton', v)} />
            </Row>
            <Row label="Keep screen awake" hint="Recommended on for exhibitions.">
              <Switch value={draft.keepAwake} onValueChange={(v) => set('keepAwake', v)} />
            </Row>
            <Row
              label="Real-time updates"
              hint="Recommended. The server pushes changes instantly over one connection, using far fewer requests than checking every few seconds."
            >
              <Switch value={draft.liveUpdates} onValueChange={(v) => set('liveUpdates', v)} />
            </Row>
            <Row
              label="Fallback check interval (ms)"
              hint="Used only while real-time updates are off or unavailable. Original: 1500ms · 500–10000"
            >
              <NumberInput value={draft.pollIntervalMs} onChange={(v) => set('pollIntervalMs', v)} />
            </Row>
          </Section>

          <Section title="Server (Cloudflare)" footer="The iPhone and iPad must use the same server URL and token.">
            <Text style={styles.label}>Server URL</Text>
            <TextInput
              style={styles.input}
              value={draft.serverUrl}
              onChangeText={(v) => set('serverUrl', v)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://make-a-wish-server.xxxx.workers.dev"
            />
            <Text style={styles.label}>API token</Text>
            <TextInput
              style={styles.input}
              value={draft.apiToken}
              onChangeText={(v) => set('apiToken', v)}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={styles.buttonRow}>
              <SmallButton label="Test connection" onPress={testConnection} disabled={testState.busy} />
              <SmallButton
                label="Use defaults"
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

          <Section title="Maintenance">
            <View style={styles.buttonRow}>
              <SmallButton label="Clear currentdata" onPress={confirmClear} danger />
              <SmallButton label="Reset settings" onPress={confirmReset} subtle />
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

import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { useLiveTransport, type LiveTransport } from '../live/LiveCurrent';
import { useSettings } from '../settings/SettingsContext';
import { colors } from '../theme';

const TRANSPORT_LABEL: Record<LiveTransport, string> = {
  live: 'connected (real-time)',
  polling: 'checking periodically (real-time unavailable)',
  off: 'not connected',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  /** 화면 미리보기 (서버·NFC 없이 모양만) */
  onOpenPreview: () => void;
}

export function AdminMenu({ visible, onClose, onRestart, onOpenSettings, onOpenPreview }: Props) {
  const { resolvedMode, update } = useSettings();
  const transport = useLiveTransport();
  const other = resolvedMode === 'ipad' ? 'iphone' : 'ipad';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Admin menu</Text>
          <Text style={styles.subtitle}>
            Current mode: {resolvedMode === 'ipad' ? 'iPad guide (wish writing)' : 'iPhone guide (NFC prompt)'}
            {'\n'}
            Server: {TRANSPORT_LABEL[transport]}
          </Text>
          <MenuButton
            label={resolvedMode === 'ipad' ? 'Back to start (language)' : 'Back to main screen'}
            onPress={() => {
              onRestart();
              onClose();
            }}
          />
          <MenuButton
            label={other === 'iphone' ? 'Switch to iPhone guide' : 'Switch to iPad guide'}
            onPress={async () => {
              await update({ mode: other });
              onRestart();
              onClose();
            }}
          />
          <MenuButton label="Screen preview (no server)" onPress={onOpenPreview} />
          <MenuButton label="Settings" onPress={onOpenSettings} />
          <MenuButton label="Close" onPress={onClose} subtle />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuButton({ label, onPress, subtle }: { label: string; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, subtle && styles.subtle, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <Text style={[styles.buttonText, subtle && { color: colors.black }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.gray, textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: colors.brown,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subtle: { backgroundColor: '#EFEFF4' },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '600' },
});

import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { useSettings } from '../settings/SettingsContext';
import { colors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
}

export function AdminMenu({ visible, onClose, onRestart, onOpenSettings }: Props) {
  const { resolvedMode } = useSettings();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>관리자 메뉴</Text>
          <Text style={styles.subtitle}>
            현재 모드: {resolvedMode === 'ipad' ? 'iPad 가이드 (소원 작성)' : 'iPhone 가이드 (NFC 안내)'}
          </Text>
          <MenuButton
            label={resolvedMode === 'ipad' ? '처음 화면(언어 선택)으로' : '메인 화면으로'}
            onPress={() => {
              onRestart();
              onClose();
            }}
          />
          <MenuButton label="설정" onPress={onOpenSettings} />
          <MenuButton label="닫기" onPress={onClose} subtle />
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

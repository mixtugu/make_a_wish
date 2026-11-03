import { Pressable, StyleSheet, Text, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ADMIN_LONG_PRESS_MS = 2000;

/**
 * 관리자 메뉴 진입점 (화면 오른쪽 위).
 * - visible: 반투명 톱니바퀴 버튼, 탭하면 바로 열림
 * - 숨김: 보이지 않는 영역을 2초간 길게 눌러야 열림 (전시 중 관람객이 실수로 열지 않도록)
 */
export function AdminHotspot({ onOpen, visible }: { onOpen: () => void; visible: boolean }) {
  const insets = useSafeAreaInsets();

  if (visible) {
    return (
      <Pressable
        onPress={onOpen}
        hitSlop={12}
        style={({ pressed }) => [
          styles.button,
          { top: insets.top + 12, right: insets.right + 12, opacity: pressed ? 0.9 : 0.55 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Settings menu"
      >
        <Text allowFontScaling={false} style={styles.icon}>
          ⚙︎
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onLongPress={() => {
        Vibration.vibrate(30);
        onOpen();
      }}
      delayLongPress={ADMIN_LONG_PRESS_MS}
      style={[styles.hotspot, { top: 0, right: 0, width: 80 + insets.right, height: 80 + insets.top }]}
      accessibilityLabel="Admin menu (long-press for 2 seconds)"
    />
  );
}

const styles = StyleSheet.create({
  hotspot: { position: 'absolute', zIndex: 100 },
  button: {
    position: 'absolute',
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24, lineHeight: 28, color: '#3C3C43' },
});

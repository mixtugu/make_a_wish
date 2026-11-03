import { Pressable, StyleSheet, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ADMIN_LONG_PRESS_MS = 2000;

/**
 * 관람객에게 보이지 않는 관리자 진입점: 화면 오른쪽 위 모서리를 2초간 길게 누르기.
 * 짧은 탭은 무시되므로 전시 중 실수로 열릴 일이 거의 없습니다.
 */
export function AdminHotspot({ onOpen }: { onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onLongPress={() => {
        Vibration.vibrate(30);
        onOpen();
      }}
      delayLongPress={ADMIN_LONG_PRESS_MS}
      style={[styles.hotspot, { top: 0, right: 0, width: 80 + insets.right, height: 80 + insets.top }]}
      accessibilityLabel="관리자 메뉴 (2초간 길게 누르기)"
    />
  );
}

const styles = StyleSheet.create({
  hotspot: { position: 'absolute', zIndex: 100 },
});

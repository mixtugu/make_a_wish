import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SvgAsset } from './SvgAsset';

/** 원본 FooterView: 화면 하단 중앙의 "make a wish" 로고 (204×39) */
export function Footer({ scale = 1 }: { scale?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]} pointerEvents="none">
      <SvgAsset name="footer" width={204 * Math.max(scale, 0.8)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8 },
});

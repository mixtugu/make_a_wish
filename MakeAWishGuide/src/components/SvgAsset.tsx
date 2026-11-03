import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgCss } from 'react-native-svg/css';

import { svgAssets, type SvgAssetName } from '../assets/svgs';

interface Props {
  name: SvgAssetName;
  /** width 만 주면 원본 비율로 height 계산 (scaledToFit) */
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
}

/**
 * 원본 Xcode 프로젝트에서 가져온 SVG(src/assets/svgs.ts)를 그대로 렌더링합니다.
 * Illustrator SVG 의 <style> 클래스를 지원하기 위해 SvgCss 를 사용합니다.
 */
function SvgAssetImpl({ name, width, height, style, opacity }: Props) {
  const asset = svgAssets[name];
  const ratio = asset.width / asset.height;
  let w = width;
  let h = height;
  if (w !== undefined && h !== undefined) {
    // 박스 안에 비율 유지하며 맞춤
    if (w / h > ratio) w = h * ratio;
    else h = w / ratio;
  } else if (w !== undefined) h = w / ratio;
  else if (h !== undefined) w = h * ratio;
  else {
    w = asset.width;
    h = asset.height;
  }

  return (
    <View style={[{ width: w, height: h, opacity }, style]} pointerEvents="none">
      <SvgCss xml={asset.xml} width="100%" height="100%" />
    </View>
  );
}

export const SvgAsset = memo(SvgAssetImpl);

export function svgRatio(name: SvgAssetName): number {
  const a = svgAssets[name];
  return a.width / a.height;
}

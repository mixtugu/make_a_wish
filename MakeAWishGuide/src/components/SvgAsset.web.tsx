import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { svgAssets, type SvgAssetName } from '../assets/svgs';

/**
 * 브라우저 테스트용 SVG 표시: 큰 SVG 를 <img> 한 장으로 그려 가볍게 (브라우저가 <style> 도 처리).
 * iPhone/iPad 앱은 SvgAsset.tsx (react-native-svg) 를 씁니다.
 */
interface Props {
  name: SvgAssetName;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
}

const uriCache = new Map<SvgAssetName, string>();
function svgUri(name: SvgAssetName): string {
  let uri = uriCache.get(name);
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgAssets[name].xml)}`;
    uriCache.set(name, uri);
  }
  return uri;
}

const imgStyle = {
  width: '100%',
  height: '100%',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
} as const;

function SvgAssetImpl({ name, width, height, style, opacity }: Props) {
  const asset = svgAssets[name];
  const ratio = asset.width / asset.height;
  let w = width;
  let h = height;
  if (w !== undefined && h !== undefined) {
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
      <img src={svgUri(name)} alt="" draggable={false} style={imgStyle} />
    </View>
  );
}

export const SvgAsset = memo(SvgAssetImpl);

export function svgRatio(name: SvgAssetName): number {
  const a = svgAssets[name];
  return a.width / a.height;
}

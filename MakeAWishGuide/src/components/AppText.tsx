import { Text, type TextProps, type TextStyle } from 'react-native';

import { fontFor } from '../fonts';
import type { AppLanguage } from '../i18n/types';

interface Props extends TextProps {
  lang: AppLanguage;
  size: number;
  /** 원본 appSecondaryFont (손글씨 계열) */
  secondary?: boolean;
  weight?: TextStyle['fontWeight'];
  /** SwiftUI lineSpacing (줄 사이 추가 간격) */
  lineSpacing?: number;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** 원본 `.appFont(lang, size:)` / `.appSecondaryFont(lang, size:)` 대응 */
export function AppText({
  lang,
  size,
  secondary,
  weight,
  lineSpacing = 0,
  color = '#000',
  align = 'center',
  style,
  ...rest
}: Props) {
  const fontFamily = fontFor(lang, secondary);
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily,
          fontSize: size,
          // 단일 굵기 커스텀 폰트에 굵기를 지정하면 iOS 가 다른 폰트로 대체할 수 있어
          // 굵기 변형이 있는 시스템 폰트일 때만 적용
          fontWeight: !fontFamily || fontFamily === 'Apple SD Gothic Neo' ? weight : undefined,
          lineHeight: Math.round(size * 1.25 + lineSpacing),
          color,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * 원본 SwiftUI 레이아웃은 iPad 11"(834×1194pt) 기준의 고정 수치였습니다.
 * 화면 크기에 맞춰 같은 비율로 키우거나 줄이기 위한 스케일 함수.
 */
export function useScale(design: { width: number; height: number }) {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const s = Math.min(width / design.width, height / design.height);
    const scale = (n: number) => Math.round(n * s * 100) / 100;
    return { s, scale, width, height };
  }, [width, height, design.width, design.height]);
}

import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../components/AppText';
import {
  DrawingCanvas,
  type DrawingCanvasHandle,
  type DrawingTool,
} from '../../../components/DrawingCanvas';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { STATUS } from '../../../config/defaults';
import { useScale } from '../../../hooks/useScale';
import { useApi } from '../../../hooks/useApi';
import { flowStrings, strings } from '../../../i18n/strings';
import { insertStatus } from '../../../services/wishFlow';
import { colors, IPAD_DESIGN } from '../../../theme';
import { log } from '../../../utils/log';
import type { IPadScreenProps } from '../types';

/**
 * 원본 DrawWishView 레이아웃 (iPad 11" 기준 pt)
 * newema(696×1059) 를 maxHeight 1100 으로 맞추고 x+20 이동 → 이 좌표계를 기준으로 캔버스를
 * 에마의 줄 그어진 판(viewBox y 681~1057) 위에 정확히 겹칩니다.
 */
const EMA_K = 1100 / 1059;
const EMA_W = 696 * EMA_K;
const EMA_H = 1100;
const EMA_LEFT = (IPAD_DESIGN.width - EMA_W) / 2 + 20;
const BOARD = {
  left: EMA_LEFT + 2 * EMA_K,
  top: 682 * EMA_K,
  width: 655 * EMA_K,
  height: (1056 - 682) * EMA_K,
};
/** 에마 지붕 꼭짓점의 x (가운데 정렬 기준) */
const ROOF_CENTER_X = EMA_LEFT + 321 * EMA_K;

const INK_COLORS = ['#000000', '#D00000', '#1E5BD8', '#1F8A3B', '#F28C28', '#7B3FBF'];
const WIDTHS = [3, 6, 10, 16];

/** 원본 bottomPaddingForLang() – 언어별 문구 길이 차이 보정 */
const USE_PEN_BOTTOM = { ja: 28, en: 33 } as const;

export function DrawWishScreen({ session, update, next, preview }: IPadScreenProps) {
  const { scale: sc, s } = useScale(IPAD_DESIGN);
  const insets = useSafeAreaInsets();
  const db = useApi();
  const { lang, nationality } = session;
  const t = strings.draw;
  // 질문·카드 안내는 사용자 유형별 (이 화면은 유형을 고른 뒤에만 옴)
  const userType = nationality ?? 'foreignResident';

  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState(INK_COLORS[0]);
  const [width, setWidth] = useState(6); // 원본 inkWidth 기본값
  const [drawing, setDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const onFinish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const image = canvasRef.current?.exportPng() ?? null;
      log('draw', `이미지 생성: ${image ? `${Math.round(image.width)}x${Math.round(image.height)}` : '실패'}`);
      update({ drawing: image });
      try {
        if (!preview) await insertStatus(db, STATUS.waiting); // 미리보기에서는 서버에 쓰지 않음
      } catch (e) {
        // 원본과 동일: 실패해도 다음 화면으로 진행
        log('draw', 'waiting insert 실패', e);
      }
      await next();
    } finally {
      setBusy(false);
    }
  };

  // 기록할 카드: 외국인 빨강(drawnext2), 일본인 노랑(drawnext1)
  const nextImage = nationality === 'foreignResident' ? 'drawnext2' : 'drawnext1';
  const emaLeft = sc(EMA_LEFT);
  const emaStyle = useMemo(() => ({ position: 'absolute' as const, left: emaLeft, top: 0 }), [emaLeft]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom }}
      scrollEnabled={!drawing}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* 설계 폭(834pt)의 프레임을 가운데 정렬 → 다른 크기의 iPad 에서도 절대 좌표가 어긋나지 않음 */}
      <View style={{ height: sc(EMA_H), width: sc(IPAD_DESIGN.width), alignSelf: 'center' }}>
        {/* 큰 SVG(580KB)라 스타일 객체를 고정해 획을 그을 때마다 다시 그리지 않도록 함 */}
        <SvgAsset name="newema" width={sc(EMA_W)} style={emaStyle} />

        {/* 설명 + "이 펜을 사용하여…" */}
        <View style={[styles.textArea, { paddingTop: insets.top + sc(40), gap: sc(20) }]}>
          <View
            style={[
              styles.descBox,
              { maxWidth: sc(650), padding: sc(16), borderRadius: sc(16), marginHorizontal: sc(16) },
            ]}
          >
            <AppText lang={lang} size={sc(28)} lineSpacing={sc(14)} align="left">
              {flowStrings.question[userType][lang]}
            </AppText>
          </View>
          <View
            style={{
              maxWidth: sc(600),
              marginTop: sc(30) - sc(20),
              paddingBottom: sc(USE_PEN_BOTTOM[lang]),
            }}
          >
            <View style={{ justifyContent: 'center' }}>
              <AppText lang={lang} size={sc(28)} secondary weight="700" lineSpacing={sc(18)}>
                {t.usePen[lang]}
              </AppText>
              {/* 오른쪽 펜을 가리키는 화살표 (원본 direct: trailing overlay, offset x 180, opacity .3) */}
              <SvgAsset
                name="direct"
                width={sc(120)}
                height={sc(120)}
                opacity={0.3}
                style={{ position: 'absolute', right: -sc(180) }}
              />
            </View>
          </View>
        </View>

        {/* 도구 막대 (원본: ColorPicker / 펜 / 지우개 / 굵기 슬라이더) */}
        <View
          style={[
            styles.toolbarRow,
            // 에마 지붕 꼭짓점 아래 가운데
            { top: sc(BOARD.top) - sc(70), left: sc(ROOF_CENTER_X - IPAD_DESIGN.width / 2) },
          ]}
          pointerEvents="box-none"
        >
        <View
          style={[
            styles.toolbar,
            {
              height: sc(56),
              borderRadius: sc(28),
              paddingHorizontal: sc(12),
              gap: sc(7),
            },
          ]}
        >
          {INK_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => {
                setColor(c);
                setTool('pen');
              }}
              accessibilityLabel={`color ${c}`}
              hitSlop={4}
              style={{
                width: sc(30),
                height: sc(30),
                borderRadius: sc(15),
                backgroundColor: c,
                borderWidth: color === c && tool === 'pen' ? 3 : 1,
                borderColor: color === c && tool === 'pen' ? colors.accent : 'rgba(0,0,0,0.25)',
              }}
            />
          ))}
          <View style={styles.divider} />
          <ToolButton label="✏️" active={tool === 'pen'} onPress={() => setTool('pen')} s={s} a11y={t.pen[lang]} />
          <ToolButton label="🧽" active={tool === 'eraser'} onPress={() => setTool('eraser')} s={s} a11y={t.eraser[lang]} />
          <View style={styles.divider} />
          {WIDTHS.map((w) => (
            <Pressable
              key={w}
              onPress={() => setWidth(w)}
              accessibilityLabel={`width ${w}`}
              style={[
                styles.widthButton,
                {
                  width: sc(34),
                  height: sc(34),
                  borderRadius: sc(17),
                  backgroundColor: width === w ? 'rgba(0,122,255,0.15)' : 'transparent',
                },
              ]}
            >
              <View
                style={{
                  width: Math.max(3, w * s),
                  height: Math.max(3, w * s),
                  borderRadius: 99,
                  backgroundColor: tool === 'pen' ? color : '#555',
                }}
              />
            </Pressable>
          ))}
          <View style={styles.divider} />
          <ToolButton
            label="↶"
            onPress={() => canvasRef.current?.undo()}
            disabled={strokeCount === 0}
            s={s}
            a11y={t.undo[lang]}
          />
          <ToolButton
            label="🗑"
            onPress={() => canvasRef.current?.clear()}
            disabled={strokeCount === 0}
            s={s}
            a11y={t.erase[lang]}
          />
        </View>
        </View>

        {/* 에마 판 위의 드로잉 영역 */}
        <View style={{ position: 'absolute', left: sc(BOARD.left), top: sc(BOARD.top) }}>
          <DrawingCanvas
            ref={canvasRef}
            width={sc(BOARD.width)}
            height={sc(BOARD.height)}
            tool={tool}
            color={color}
            strokeWidth={width}
            onActiveChange={setDrawing}
            onChange={setStrokeCount}
          />
        </View>
      </View>

      {/* 스크롤 안내 + 다음 단계 */}
      <View style={styles.bottom}>
        <SvgAsset name="scroll" width={sc(579)} style={{ marginTop: sc(10) }} />
        <AppText
          lang={lang}
          size={sc(30)}
          secondary
          weight="700"
          style={{ paddingVertical: sc(20), paddingHorizontal: sc(16) }}
        >
          {flowStrings.pickRecordCard[userType][lang]}
        </AppText>
        <Pressable
          onPress={onFinish}
          disabled={busy}
          accessibilityRole="button"
          accessibilityHint="Tap to finish and proceed"
          style={({ pressed }) => ({ opacity: pressed || busy ? 0.6 : 1 })}
        >
          <SvgAsset name={nextImage} height={sc(400)} />
          {busy && (
            <View style={styles.busy}>
              <ActivityIndicator size="large" color={colors.brown} />
              <AppText lang={lang} size={sc(20)} style={{ marginTop: 8 }}>
                {t.sending[lang]}
              </AppText>
            </View>
          )}
        </Pressable>
        <View style={{ height: sc(16) }} />
        <Footer scale={s} />
      </View>
    </ScrollView>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onPress,
  s,
  a11y,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  s: number;
  a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected: active, disabled }}
      style={[
        styles.toolButton,
        {
          width: 44 * s,
          height: 40 * s,
          borderRadius: 10 * s,
          backgroundColor: active ? 'rgba(0,122,255,0.18)' : 'rgba(142,142,147,0.12)',
          borderColor: active ? colors.accent : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Text allowFontScaling={false} style={{ fontSize: 20 * s, color: colors.black }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  textArea: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  descBox: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  toolbarRow: { position: 'absolute', width: '100%', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  divider: { width: 1, height: '60%', backgroundColor: 'rgba(0,0,0,0.15)' },
  toolButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  widthButton: { alignItems: 'center', justifyContent: 'center' },
  bottom: { alignItems: 'center' },
  busy: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

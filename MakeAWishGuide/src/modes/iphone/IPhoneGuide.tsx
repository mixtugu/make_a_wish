import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SvgAsset, svgRatio } from '../../components/SvgAsset';
import { STATUS } from '../../config/defaults';
import { chalkduster } from '../../fonts';
import { useApi } from '../../hooks/useApi';
import { useScale } from '../../hooks/useScale';
import { iphoneStrings } from '../../i18n/strings';
import { useCurrentStatus } from '../../live/LiveCurrent';
import { failNfc, finishNfc, isNfcAvailable, readTagId } from '../../services/nfc';
import { markTagged } from '../../services/wishFlow';
import { useSettings } from '../../settings/SettingsContext';
import { TestTagPanel } from '../../testmode/TestTagPanel';
import { colors, IPHONE_DESIGN } from '../../theme';

export type ActiveStatus = typeof STATUS.waiting | typeof STATUS.unlockWaiting;

/**
 * iPhone 가이드 (원본 MainView + NFCView)
 * - currentdata 에 waiting / unlockwaiting 행이 있으면 NFC 안내 화면
 * - 없어지면(태그 처리 완료) 메인 화면으로 복귀
 */
const ACTIVE_STATUSES = [STATUS.waiting, STATUS.unlockWaiting] as const;

export function IPhoneGuide() {
  // 서버가 실시간으로 알려 주는 currentdata 기준 (LiveCurrentProvider)
  const status = useCurrentStatus(ACTIVE_STATUSES) as ActiveStatus | null;
  return status ? <NfcScreen status={status} /> : <IdleScreen />;
}

function MakeAWishCircle({ title, s }: { title: string; s: number }) {
  return (
    <View style={[styles.circleWrap, { width: 200 * s, height: 200 * s }]}>
      <View
        style={[
          styles.circle,
          { width: 200 * s, height: 200 * s, borderRadius: 100 * s, borderWidth: 6 * s },
        ]}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        // maxWidth: 웹에서는 numberOfLines 가 원 크기로 줄여 말줄임이 되므로 원본처럼 원 밖으로 넘치게 지정
        style={[styles.circleText, { fontFamily: chalkduster, fontSize: 39 * s, width: 420 * s, maxWidth: 420 * s }]}
      >
        {title}
      </Text>
    </View>
  );
}

/** 원본 MainView */
export function IdleScreen() {
  const { s } = useScale(IPHONE_DESIGN);
  return (
    <View style={styles.center}>
      <MakeAWishCircle title={iphoneStrings.idleTitle} s={s} />
    </View>
  );
}

type ScanState = 'off' | 'scanning' | 'idle' | 'unavailable';

/** 원본 NFCView */
/** preview: 화면 미리보기 (NFC 읽기·테스트 버튼 없이 모양만) */
export function NfcScreen({ status, preview = false }: { status: ActiveStatus; preview?: boolean }) {
  const { settings } = useSettings();
  const inAppScan = settings.nfcInAppScan && !preview;
  const db = useApi();
  const { s, width } = useScale(IPHONE_DESIGN);
  const [scan, setScan] = useState<ScanState>(inAppScan ? 'idle' : 'off');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      finishNfc();
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!inAppScan) return;
    if (!(await isNfcAvailable())) {
      if (mounted.current) setScan('unavailable');
      return;
    }
    if (mounted.current) setScan('scanning');
    const id = await readTagId('소원 종이를 휴대폰 상단에 대주세요 · Hold the wish paper near the top of the iPhone');
    if (!mounted.current) {
      await finishNfc();
      return;
    }
    if (!id) {
      setScan('idle');
      return;
    }
    try {
      // 서버가 태그 순간의 실제 상태(waiting / unlockwaiting)를 기준으로 갱신
      const n = await markTagged(db, id);
      if (n > 0) await finishNfc('✓ make a wish');
      else await failNfc('Already processed');
    } catch {
      await failNfc('Could not reach the server – please try again');
    }
    if (mounted.current) setScan('idle');
  }, [db, inAppScan]);

  // 화면이 뜨면 (화면을 먼저 그린 뒤) 자동으로 한 번 스캔 시작
  useEffect(() => {
    if (!inAppScan) return;
    const timer = setTimeout(startScan, 400);
    return () => clearTimeout(timer);
  }, [inAppScan, startScan]);

  // nfctouchphone 이미지 안의 주황색 원(cx 23.86, cy 11.97, r 8.95 / 46.87×38.17) 위에 문구 배치
  const imageW = Math.min(width - 32, 440 * s) * 1.1;
  const imageH = imageW / svgRatio('nfctouchphone');
  const circleD = (17.9 / 46.87) * imageW;
  const circleCx = (23.86 / 46.87) * imageW;
  const circleCy = (11.97 / 38.17) * imageH;
  const message = status === STATUS.unlockWaiting ? iphoneStrings.unlockWaiting : iphoneStrings.waiting;
  const fontSize = Math.min(29 * s, circleD / 4.6);

  return (
    <Pressable
      style={styles.center}
      onPress={scan === 'idle' ? startScan : undefined}
      accessibilityRole={scan === 'idle' ? 'button' : undefined}
    >
      <View style={{ width: imageW, height: imageH, marginBottom: 20 * s }}>
        <SvgAsset name="nfctouchphone" width={imageW} />
        <View
          style={[
            styles.messageBox,
            { left: circleCx - circleD / 2, top: circleCy - circleD / 2, width: circleD, height: circleD },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: chalkduster,
              fontSize,
              lineHeight: fontSize * 1.25,
              color: colors.white,
              textAlign: 'center',
            }}
          >
            {message}
          </Text>
        </View>
      </View>
      <MakeAWishCircle title={iphoneStrings.circleTitle} s={s} />
      {/* 테스트 모드: 이 iPhone 에 카드를 댄 것처럼 */}
      {!preview && (
        <TestTagPanel kind={status === STATUS.unlockWaiting ? 'release' : 'record'} style={{ bottom: 24 }} />
      )}
      {scan === 'idle' && (
        <Text style={[styles.hint, { fontSize: 15 * s }]}>Tap the screen to start an NFC scan</Text>
      )}
      {scan === 'unavailable' && (
        <Text style={[styles.hint, { fontSize: 13 * s }]}>
          NFC is not available on this device/build (needs a development build)
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleWrap: { alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', borderColor: colors.white },
  circleText: { color: colors.black, textAlign: 'center', flexShrink: 0 },
  messageBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 48, color: 'rgba(0,0,0,0.45)', textAlign: 'center' },
});

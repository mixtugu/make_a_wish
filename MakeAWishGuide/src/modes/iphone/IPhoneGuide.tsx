import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SvgAsset, svgRatio } from '../../components/SvgAsset';
import { STATUS } from '../../config/defaults';
import { chalkduster } from '../../fonts';
import { usePolling } from '../../hooks/usePolling';
import { useScale } from '../../hooks/useScale';
import { useApi } from '../../hooks/useApi';
import { iphoneStrings } from '../../i18n/strings';
import { failNfc, finishNfc, isNfcAvailable, readTagId } from '../../services/nfc';
import { findCurrentStatus, markTagged } from '../../services/wishFlow';
import { useSettings } from '../../settings/SettingsContext';
import { colors, IPHONE_DESIGN } from '../../theme';

type ActiveStatus = typeof STATUS.waiting | typeof STATUS.unlockWaiting;

/**
 * iPhone 가이드 (원본 MainView + NFCView)
 * - currentdata 에 waiting / unlockwaiting 행이 있으면 NFC 안내 화면
 * - 없어지면(태그 처리 완료) 메인 화면으로 복귀
 */
export function IPhoneGuide() {
  const { settings } = useSettings();
  const db = useApi();
  const [status, setStatus] = useState<ActiveStatus | null>(null);

  usePolling(
    async () => {
      const s = await findCurrentStatus(db, [STATUS.waiting, STATUS.unlockWaiting]);
      setStatus(s === STATUS.waiting || s === STATUS.unlockWaiting ? s : null);
    },
    settings.pollIntervalMs,
    true,
    'iphone',
  );

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
        style={[styles.circleText, { fontFamily: chalkduster, fontSize: 39 * s, width: 420 * s }]}
      >
        {title}
      </Text>
    </View>
  );
}

/** 원본 MainView */
function IdleScreen() {
  const { s } = useScale(IPHONE_DESIGN);
  return (
    <View style={styles.center}>
      <MakeAWishCircle title={iphoneStrings.idleTitle} s={s} />
    </View>
  );
}

type ScanState = 'off' | 'scanning' | 'idle' | 'unavailable';

/** 원본 NFCView */
function NfcScreen({ status }: { status: ActiveStatus }) {
  const { settings } = useSettings();
  const db = useApi();
  const { s, width } = useScale(IPHONE_DESIGN);
  const [scan, setScan] = useState<ScanState>(settings.nfcInAppScan ? 'idle' : 'off');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      finishNfc();
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!settings.nfcInAppScan) return;
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
      else await failNfc('이미 처리되었습니다');
    } catch {
      await failNfc('서버 연결 실패 – 다시 시도해 주세요');
    }
    if (mounted.current) setScan('idle');
  }, [db, settings.nfcInAppScan]);

  // 화면이 뜨면 (화면을 먼저 그린 뒤) 자동으로 한 번 스캔 시작
  useEffect(() => {
    if (!settings.nfcInAppScan) return;
    const timer = setTimeout(startScan, 400);
    return () => clearTimeout(timer);
  }, [settings.nfcInAppScan, startScan]);

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
      {scan === 'idle' && (
        <Text style={[styles.hint, { fontSize: 15 * s }]}>화면을 탭하면 NFC 스캔을 시작합니다</Text>
      )}
      {scan === 'unavailable' && (
        <Text style={[styles.hint, { fontSize: 13 * s }]}>
          이 기기/빌드에서는 NFC 를 사용할 수 없습니다 (개발 빌드 필요)
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
  circleText: { color: colors.black, textAlign: 'center' },
  messageBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 48, color: 'rgba(0,0,0,0.45)', textAlign: 'center' },
});

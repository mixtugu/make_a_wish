import { useEffect, useEffectEvent, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '../../../components/AppText';
import { Footer } from '../../../components/Footer';
import { SvgAsset } from '../../../components/SvgAsset';
import { STATUS } from '../../../config/defaults';
import { useApi } from '../../../hooks/useApi';
import { useScale } from '../../../hooks/useScale';
import { strings } from '../../../i18n/strings';
import { useCurrentStatus } from '../../../live/LiveCurrent';
import { transferTaggedToLocked } from '../../../services/wishFlow';
import { colors, IPAD_DESIGN } from '../../../theme';
import { log } from '../../../utils/log';
import type { IPadScreenProps } from '../types';

const TAGGED = [STATUS.nfcTagged] as const;

/**
 * 원본 SavedNextView
 * 그린 소원을 보여주고, 소원 종이를 iPhone 에 태그(status=nfctagged)하면
 * 이미지 업로드 + lockeddata 이관 후 다음 화면으로.
 */
export function SavedNextScreen({ session, go }: IPadScreenProps) {
  const { scale: sc, s } = useScale(IPAD_DESIGN);
  const db = useApi();
  const { lang, nationality, drawing } = session;
  const handled = useRef(false);
  const tagged = useCurrentStatus(TAGGED);

  const onTagged = useEffectEvent(async () => {
    if (handled.current) return;
    handled.current = true;
    log('savedNext', 'nfctagged 감지 → lockeddata 로 이관');
    try {
      await transferTaggedToLocked(db, drawing?.bytes ?? null);
    } catch (e) {
      log('savedNext', '이관 실패', e);
    }
    go('attach');
  });

  useEffect(() => {
    if (tagged) onTagged();
  }, [tagged]);

  const nfcImage =
    nationality === 'japanese' ? 'nfctouchj' : nationality === 'foreignResident' ? 'nfctouchf' : 'nfctouch';

  return (
    <View style={styles.root}>
      <View style={[styles.frame, { width: sc(IPAD_DESIGN.width) }]}>
        <SvgAsset name="ema2" height={sc(500)} style={styles.ema} />

        <View style={[styles.column, { paddingTop: sc(120), gap: sc(20) }]}>
          {drawing ? (
            <View style={[styles.preview, { width: sc(575), height: sc(330), marginVertical: sc(16) }]}>
              <Image
                source={{ uri: `data:image/png;base64,${drawing.base64}` }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </View>
          ) : (
            <AppText lang={lang} size={sc(16)} color={colors.gray}>
              {strings.savedNext.noImage[lang]}
            </AppText>
          )}

          <View style={[styles.placeRow, { paddingHorizontal: sc(16) }]}>
            <SvgAsset name="direct1" height={sc(100)} style={{ marginLeft: sc(16) }} />
            <View style={styles.placeTextWrap} pointerEvents="none">
              <AppText lang={lang} size={sc(28)} secondary lineSpacing={sc(18)}>
                {strings.savedNext.place[lang]}
              </AppText>
            </View>
          </View>

          <SvgAsset
            name={nfcImage}
            width={sc(350)}
            style={{ marginTop: sc(20), transform: [{ translateX: sc(80) }] }}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Footer scale={s} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  frame: { flex: 1, alignItems: 'center' },
  ema: { position: 'absolute', top: 0 },
  column: { alignItems: 'center', alignSelf: 'stretch' },
  preview: { backgroundColor: colors.white, overflow: 'hidden' },
  placeRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  placeTextWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

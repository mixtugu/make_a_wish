import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '../../../components/AppText';
import { SvgAsset } from '../../../components/SvgAsset';
import { useScale } from '../../../hooks/useScale';
import { useApi } from '../../../hooks/useApi';
import { strings } from '../../../i18n/strings';
import { clearCurrentData } from '../../../services/wishFlow';
import { colors, IPAD_DESIGN } from '../../../theme';
import { log } from '../../../utils/log';
import type { IPadScreenProps } from '../types';

/** 원본 ThankView: currentdata 정리, 탭하면 처음(언어 선택)으로 */
export function ThankScreen({ session, restart, preview }: IPadScreenProps) {
  const { scale: sc } = useScale(IPAD_DESIGN);
  const db = useApi();
  const { lang } = session;

  useEffect(() => {
    if (!preview) clearCurrentData(db).catch((e) => log('thank', 'currentdata 정리 실패', e));
  }, [db, preview]);

  return (
    <Pressable style={[styles.root, { gap: sc(32) }]} onPress={restart} accessibilityRole="button">
      <AppText lang={lang} size={sc(48)} secondary lineSpacing={sc(18)} style={{ paddingHorizontal: sc(40) }}>
        {strings.thank.description[lang]}
      </AppText>
      <SvgAsset name="wishs" height={sc(300)} />
      <AppText lang={lang} size={sc(48)} secondary>
        {strings.thank.thankYou[lang]}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useKeepAwake } from 'expo-keep-awake';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdminHotspot } from './src/admin/AdminHotspot';
import { AdminMenu } from './src/admin/AdminMenu';
import { ScreenPreview } from './src/admin/ScreenPreview';
import { SettingsScreen } from './src/admin/SettingsScreen';
import { SetupScreen } from './src/admin/SetupScreen';
import { useGuideFonts } from './src/fonts';
import { LiveCurrentProvider } from './src/live/LiveCurrent';
import { IPadGuide } from './src/modes/ipad/IPadGuide';
import { IPhoneGuide } from './src/modes/iphone/IPhoneGuide';
import { SettingsProvider, useSettings } from './src/settings/SettingsContext';
import { TestModeBadge } from './src/testmode/TestTagPanel';
import { webModeOverride } from './src/utils/webMode';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar hidden />
        <Root />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function KeepAwake() {
  useKeepAwake('make-a-wish-kiosk');
  return null;
}

function Root() {
  const { settings, loaded, resolvedMode } = useSettings();
  // 브라우저 테스트에서 주소로 모드를 지정하면(?mode=) 최초 설정 화면을 건너뜀
  const setupDone = settings.setupDone || webModeOverride() !== null;
  const fontsReady = useGuideFonts(loaded && setupDone ? resolvedMode : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // key 를 바꿔 가이드를 처음 상태로 다시 마운트
  const [sessionKey, setSessionKey] = useState(0);

  const ready = loaded && (!setupDone || fontsReady);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const restart = useCallback(() => setSessionKey((k) => k + 1), []);
  const openSettings = useCallback(() => {
    setMenuOpen(false);
    // iOS 는 모달이 닫히는 중에 다른 모달을 띄우지 못하므로 잠시 대기
    setTimeout(() => setSettingsOpen(true), 400);
  }, []);
  const openPreview = useCallback(() => {
    setMenuOpen(false);
    setTimeout(() => setPreviewOpen(true), 400);
  }, []);

  if (!ready) return <View style={styles.root} />;
  if (!setupDone) return <SetupScreen />;

  return (
    // 서버 상태를 실시간으로 받는 연결 하나를 앱 전체가 공유
    <LiveCurrentProvider>
      <View style={styles.root}>
        {settings.keepAwake && <KeepAwake />}
        {resolvedMode === 'ipad' ? (
          <IPadGuide key={`ipad-${sessionKey}`} />
        ) : (
          <IPhoneGuide key={`iphone-${sessionKey}`} />
        )}
        <TestModeBadge />
        <AdminHotspot onOpen={() => setMenuOpen(true)} visible={settings.showSettingsButton} />
        <AdminMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onRestart={restart}
          onOpenSettings={openSettings}
          onOpenPreview={openPreview}
        />
        {previewOpen && <ScreenPreview onClose={() => setPreviewOpen(false)} />}
        {settingsOpen && (
          <SettingsScreen
            onClose={() => setSettingsOpen(false)}
            // 저장하면 가이드를 처음부터 다시 시작해 새 설정(언어/서버 등)을 반영
            onSaved={restart}
          />
        )}
      </View>
    </LiveCurrentProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});

import { useKeepAwake } from 'expo-keep-awake';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AdminHotspot } from './src/admin/AdminHotspot';
import { AdminMenu } from './src/admin/AdminMenu';
import { SettingsScreen } from './src/admin/SettingsScreen';
import { SetupScreen } from './src/admin/SetupScreen';
import { useGuideFonts } from './src/fonts';
import { IPadGuide } from './src/modes/ipad/IPadGuide';
import { IPhoneGuide } from './src/modes/iphone/IPhoneGuide';
import { SettingsProvider, useSettings } from './src/settings/SettingsContext';
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
  const fontsReady = useGuideFonts(loaded && settings.setupDone ? resolvedMode : null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // key 를 바꿔 가이드를 처음 상태로 다시 마운트
  const [sessionKey, setSessionKey] = useState(0);

  const ready = loaded && (!settings.setupDone || fontsReady);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const restart = useCallback(() => setSessionKey((k) => k + 1), []);
  const openSettings = useCallback(() => {
    setMenuOpen(false);
    // iOS 는 모달이 닫히는 중에 다른 모달을 띄우지 못하므로 잠시 대기
    setTimeout(() => setSettingsOpen(true), 400);
  }, []);

  if (!ready) return <View style={styles.root} />;
  if (!settings.setupDone) return <SetupScreen />;

  return (
    <View style={styles.root}>
      {settings.keepAwake && <KeepAwake />}
      {resolvedMode === 'ipad' ? (
        <IPadGuide key={`ipad-${sessionKey}`} />
      ) : (
        <IPhoneGuide key={`iphone-${sessionKey}`} />
      )}
      <AdminHotspot onOpen={() => setMenuOpen(true)} />
      <AdminMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onRestart={restart}
        onOpenSettings={openSettings}
      />
      {settingsOpen && (
        <SettingsScreen
          onClose={() => setSettingsOpen(false)}
          // 저장하면 가이드를 처음부터 다시 시작해 새 설정(언어/서버 등)을 반영
          onSaved={restart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});

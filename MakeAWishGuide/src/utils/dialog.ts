import { Alert, Platform } from 'react-native';

/**
 * 확인·알림 창. 앱에서는 기존 Alert, 브라우저 테스트에서는 브라우저 기본 창
 * (React Native 의 Alert 는 웹에서 아무것도 하지 않음)
 */
export function confirmDestructive(title: string, message: string, actionLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

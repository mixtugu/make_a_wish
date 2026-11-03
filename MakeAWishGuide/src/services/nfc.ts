import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

import { log } from '../utils/log';

type NfcModule = typeof import('react-native-nfc-manager');

/**
 * react-native-nfc-manager 는 네이티브 모듈이라 Expo Go 에는 없습니다.
 * 개발 빌드(expo run:ios / EAS)에서만 로드되도록 지연 로딩합니다.
 */
let mod: NfcModule | null | undefined;
function nfc(): NfcModule | null {
  if (mod !== undefined) return mod;
  // 네이티브 모듈이 없으면(Expo Go) 패키지를 아예 불러오지 않음 – 불러오는 순간 오류를 던지고 개발 화면에 빨간 오류가 뜸
  const native = TurboModuleRegistry.get('NfcManager') ?? NativeModules.NfcManager;
  if (!native) {
    log('nfc', 'NFC native module not found (Expo Go?) – in-app NFC disabled');
    mod = null;
    return mod;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-nfc-manager') as NfcModule;
  } catch (e) {
    log('nfc', 'NFC 모듈을 불러올 수 없습니다 (Expo Go?)', e);
    mod = null;
  }
  return mod;
}

let started = false;

export async function isNfcAvailable(): Promise<boolean> {
  const m = nfc();
  if (!m) return false;
  try {
    const supported = await m.default.isSupported();
    if (!supported) return false;
    if (!started) {
      await m.default.start();
      started = true;
    }
    return true;
  } catch (e) {
    log('nfc', 'isSupported 실패', e);
    return false;
  }
}

function normalizeId(id: string | undefined | null): string | null {
  if (!id) return null;
  const clean = id.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return clean || null;
}

/**
 * NFC 태그를 한 번 읽어 고유 ID(UID, 16진수 대문자)를 돌려줍니다.
 * iOS 에서는 시스템 NFC 시트가 뜹니다. 사용자가 취소하거나 시간이 초과되면 null.
 */
export async function readTagId(alertMessage: string): Promise<string | null> {
  const m = nfc();
  if (!m || !(await isNfcAvailable())) return null;
  const { default: manager, NfcTech } = m;
  // NTAG(스티커) = MIFARE Ultralight 계열, ICODE = ISO15693
  const techs =
    Platform.OS === 'ios'
      ? [NfcTech.MifareIOS, NfcTech.Iso15693IOS]
      : [NfcTech.NfcA, NfcTech.NfcV, NfcTech.IsoDep, NfcTech.MifareUltralight];
  try {
    await manager.requestTechnology(techs, { alertMessage });
    const tag = await manager.getTag({ readNdef: false });
    const id = normalizeId(tag?.id);
    log('nfc', `태그 읽음: ${id}`);
    return id;
  } catch (e) {
    log('nfc', '태그 읽기 취소/실패', e);
    return null;
  }
}

/** 세션 종료 (iOS: 성공 메시지를 잠깐 보여 준 뒤 닫힘) */
export async function finishNfc(successMessage?: string): Promise<void> {
  const m = nfc();
  if (!m) return;
  try {
    if (successMessage && Platform.OS === 'ios') await m.default.setAlertMessageIOS(successMessage);
    await m.default.cancelTechnologyRequest();
  } catch {
    // 이미 닫힌 세션
  }
}

export async function failNfc(errorMessage: string): Promise<void> {
  const m = nfc();
  if (!m) return;
  try {
    if (Platform.OS === 'ios') await m.default.invalidateSessionWithErrorIOS(errorMessage);
    else await m.default.cancelTechnologyRequest();
  } catch {
    // 이미 닫힌 세션
  }
}

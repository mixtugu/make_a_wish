import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { CardColor } from '../modes/ipad/flow';

/**
 * 테스트 모드의 가상 NFC 카드.
 * nfcId 는 실제 태그 UID 와 겹치지 않도록 TEST- 로 시작합니다 (서버에는 일반 nfc_id 로 기록됨).
 */
export interface VirtualCard {
  id: string;
  color: CardColor;
  label: string;
}

export const VIRTUAL_CARDS: VirtualCard[] = [
  { id: 'TEST-RED-1', color: 'red', label: 'Red 1' },
  { id: 'TEST-RED-2', color: 'red', label: 'Red 2' },
  { id: 'TEST-RED-3', color: 'red', label: 'Red 3' },
  { id: 'TEST-YELLOW-1', color: 'yellow', label: 'Yellow 1' },
  { id: 'TEST-YELLOW-2', color: 'yellow', label: 'Yellow 2' },
  { id: 'TEST-YELLOW-3', color: 'yellow', label: 'Yellow 3' },
];

export const CARD_COLORS: Record<CardColor, { fill: string; text: string }> = {
  red: { fill: '#F2614B', text: '#FFFFFF' },
  yellow: { fill: '#F7D774', text: '#5A4A1E' },
};

/**
 * 이 기기에서 소원을 "기록"한 가상 카드 목록.
 * 해제할 때 어느 카드에 소원이 있는지 알려 주기 위한 용도라 이 기기에만 저장합니다
 * (서버의 lockeddata 가 실제 기준 – 다른 기기에서 기록한 카드는 여기 표시되지 않음).
 */
const STORAGE_KEY = 'makeawish.testCards.recorded';
let recorded: ReadonlySet<string> = new Set();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...recorded])).catch(() => {});
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const list = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(list)) {
        recorded = new Set(list.filter((v): v is string => typeof v === 'string'));
        emit();
      }
    })
    .catch(() => {});
}

export function markRecorded(id: string) {
  recorded = new Set([...recorded, id]);
  persist();
  emit();
}

export function markReleased(id: string) {
  const next = new Set(recorded);
  next.delete(id);
  recorded = next;
  persist();
  emit();
}

export function clearRecorded() {
  recorded = new Set();
  persist();
  emit();
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 이 기기에서 기록한 가상 카드 id 집합 */
export function useRecordedCards(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => recorded);
}

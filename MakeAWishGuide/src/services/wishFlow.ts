import { log } from '../utils/log';
import type { ApiClient } from './api';

/**
 * 소원 흐름. 원본 Swift 뷰들의 네트워크 로직에 해당하며, 실제 이관은 서버가 처리합니다.
 *
 *  iPad DrawWish         : currentdata ← {status: waiting}
 *  (iPhone / 단축어)      : waiting → nfctagged (+ nfc_id)               POST /api/tag
 *  iPad SavedNext         : nfctagged 행 + 그림 → lockeddata(locked)     POST /api/lock
 *  iPad WishSaved         : currentdata ← {status: unlockwaiting}
 *  (iPhone / 단축어)      : unlockwaiting → unlocknfctagged (+ nfc_id)   POST /api/tag
 *  iPad RemoveTouch       : nfc_id 로 lockeddata → unlockeddata(unlocked) POST /api/unlock
 *  iPad Thank             : currentdata 전체 정리                       DELETE /api/current
 */

const TAG = 'wishFlow';

export async function insertStatus(api: ApiClient, status: string): Promise<void> {
  await api.insertCurrent(status);
  log(TAG, `currentdata 에 ${status} 추가`);
}

/** status 가 주어진 값 중 하나인 가장 최근 currentdata 행의 status */
export async function findCurrentStatus(api: ApiClient, statuses: string[]): Promise<string | null> {
  const rows = await api.listCurrent();
  for (const row of rows) {
    const s = row.status?.toLowerCase();
    if (s && statuses.includes(s)) return s;
  }
  return null;
}

/** 원본 SavedNextView.transferNfcTaggedAndClear() */
export async function transferTaggedToLocked(api: ApiClient, image: Uint8Array | null): Promise<void> {
  const { moved, imageUrl } = await api.lock(image);
  log(TAG, `lockeddata 로 ${moved}건 이관${imageUrl ? ` · 이미지 ${imageUrl}` : ''}`);
}

/** 원본 RemoveTouchView.transferUnlockAndClear() */
export async function transferUnlockToUnlocked(api: ApiClient): Promise<void> {
  const { moved, reason } = await api.unlock();
  log(TAG, `unlockeddata 로 ${moved}건 이관${reason ? ` (${reason})` : ''}`);
}

/** 원본 ThankView: currentdata 전체 정리 */
export async function clearCurrentData(api: ApiClient): Promise<void> {
  const n = await api.clearCurrent();
  log(TAG, `currentdata ${n}건 삭제`);
}

/**
 * iPhone 앱 내 NFC 스캔: waiting → nfctagged / unlockwaiting → unlocknfctagged
 * @returns 변경된 행 수
 */
export async function markTagged(api: ApiClient, nfcId: string): Promise<number> {
  const { updated, from, to } = await api.tag(nfcId);
  log(TAG, `${from} → ${to} (nfc_id=${nfcId}), ${updated}건`);
  return updated;
}

/**
 * 브라우저 테스트용: 브라우저에는 NFC 가 없으므로 항상 "사용 불가".
 * (태그는 테스트 모드의 가상 카드 버튼으로 확인)
 */
export async function isNfcAvailable(): Promise<boolean> {
  return false;
}

export async function readTagId(_alertMessage: string): Promise<string | null> {
  return null;
}

export async function finishNfc(_successMessage?: string): Promise<void> {}

export async function failNfc(_errorMessage: string): Promise<void> {}

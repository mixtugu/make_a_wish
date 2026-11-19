import type { DrawingExport } from '../../components/DrawingCanvas';
import type { AppLanguage, Nationality } from '../../i18n/types';

/** 화면(단계). 순서는 사용자 유형에 따라 다름 – flow.ts 참고 */
export type IPadStep =
  | 'language' // LanguageChooseView
  | 'nationality' // NationalityChooseView
  | 'draw' // DrawWishView
  | 'savedNext' // SavedNextView
  | 'attach' // AttachFortuneView
  | 'wishSaved' // WishSavedView
  | 'removeTouch' // RemoveTouchView
  | 'unlocked' // UnlockedView
  | 'thank'; // ThankView

export interface IPadSession {
  /**
   * 화면에 표시할 언어.
   * 화면에 넘겨줄 때는 사용자 유형을 반영한 값입니다(일본인 → 항상 'ja').
   * 첫 화면에서 고른 언어 자체는 IPadGuide 가 따로 보관합니다.
   */
  lang: AppLanguage;
  nationality: Nationality | null;
  drawing: DrawingExport | null;
}

export interface IPadScreenProps {
  session: IPadSession;
  update: (patch: Partial<IPadSession>) => void;
  /** 사용자 유형별 순서(flow.ts)에 따라 다음 화면으로 */
  next: () => Promise<void>;
  /** 처음(언어 선택)으로 */
  restart: () => void;
  /** 화면 미리보기 중 (서버 요청·태그 처리를 하지 않음) */
  preview?: boolean;
}

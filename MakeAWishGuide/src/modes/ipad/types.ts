import type { DrawingExport } from '../../components/DrawingCanvas';
import type { AppLanguage, Nationality } from '../../i18n/types';

/** 원본 fullScreenCover 체인 순서 */
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
  lang: AppLanguage;
  nationality: Nationality | null;
  drawing: DrawingExport | null;
}

export interface IPadScreenProps {
  session: IPadSession;
  update: (patch: Partial<IPadSession>) => void;
  go: (step: IPadStep) => void;
  /** 처음(언어 선택)으로 */
  restart: () => void;
}

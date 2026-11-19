import type { Nationality } from '../../i18n/types';
import type { IPadStep } from './types';

/**
 * 사용자 유형별 체험 순서 (2026-11 수정 요청 플로차트 기준).
 *
 *  외국인: 소원 쓰기 → 빨간 카드에 기록 → 노란 카드 해제
 *  일본인: 빨간 카드 해제 → 소원 쓰기 → 노란 카드에 기록
 *
 *  기록(Record) = draw → savedNext(태그) → attach → wishSaved
 *  해제(Release) = removeTouch(태그) → unlocked
 * 공통 시작: language → nationality, 공통 끝: thank
 */
const RECORD: IPadStep[] = ['draw', 'savedNext', 'attach', 'wishSaved'];
const RELEASE: IPadStep[] = ['removeTouch', 'unlocked'];

export const FLOWS: Record<Nationality, IPadStep[]> = {
  foreignResident: ['language', 'nationality', ...RECORD, ...RELEASE, 'thank'],
  japanese: ['language', 'nationality', ...RELEASE, ...RECORD, 'thank'],
};

export type CardColor = 'red' | 'yellow';

/**
 * 각 단계에서 쓰는 카드 색 (기존 카드 그림과 같은 규칙, 서로 상대 색을 해제 = 願いの交換)
 *  외국인: 빨강에 기록, 노랑 해제 / 일본인: 노랑에 기록, 빨강 해제
 */
export function cardColor(kind: 'record' | 'release', nationality: Nationality): CardColor {
  const recordColor: CardColor = nationality === 'japanese' ? 'yellow' : 'red';
  if (kind === 'record') return recordColor;
  return recordColor === 'red' ? 'yellow' : 'red';
}

/** 현재 단계 다음 단계. 사용자 유형을 아직 고르지 않았으면 언어 → 유형 선택까지만 */
export function nextStep(current: IPadStep, nationality: Nationality | null): IPadStep {
  if (!nationality) return current === 'language' ? 'nationality' : current;
  const flow = FLOWS[nationality];
  const i = flow.indexOf(current);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : 'thank';
}

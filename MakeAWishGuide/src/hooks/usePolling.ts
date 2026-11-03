import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

import { log } from '../utils/log';

/**
 * 원본의 `while !Task.isCancelled { …; sleep(1.5s) }` 폴링 루프.
 * - tick 이 true 를 반환하면 폴링 종료
 * - 앱이 백그라운드로 가면 멈추고, 다시 활성화되면 재개 (scenePhase 처리와 동일)
 * - 같은 tick 이 겹쳐 실행되지 않음
 */
export function usePolling(
  tick: () => Promise<boolean | void>,
  intervalMs: number,
  enabled = true,
  tag = 'poll',
) {
  // 항상 최신 tick 을 호출하되, tick 이 바뀌어도 폴링 루프를 재시작하지 않음
  const onTick = useEffectEvent(tick);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let done = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = AppState.currentState !== 'background';

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      timer = null;
      if (cancelled || done || running || !active) return;
      running = true;
      try {
        if ((await onTick()) === true) done = true;
      } catch (e) {
        log(tag, '폴링 오류', e instanceof Error ? e.message : e);
      } finally {
        running = false;
      }
      if (!cancelled && !done && active) schedule(intervalMs);
    };

    const sub = AppState.addEventListener('change', (state) => {
      const nowActive = state === 'active';
      if (nowActive && !active) {
        active = true;
        schedule(0);
      } else if (state === 'background') {
        active = false;
        if (timer) clearTimeout(timer);
        timer = null;
      }
    });

    schedule(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [enabled, intervalMs, tag]);
}

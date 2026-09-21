import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useInactivityTimer(
  timeoutMinutes: number,
  onTimeout: () => void,
  enabled: boolean
) {
  const lastActivity = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= timeoutMinutes * 60 * 1000) {
        onTimeout();
      }
    }, 5000);

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        onTimeout();
      } else if (state === 'active') {
        resetTimer();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      subscription.remove();
    };
  }, [timeoutMinutes, onTimeout, enabled, resetTimer]);

  return { resetTimer };
}

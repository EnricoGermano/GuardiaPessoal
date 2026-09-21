import { useEffect, useRef, useCallback } from 'react';
import * as Clipboard from 'expo-clipboard';

export function useClipboardTimer() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyWithTimer = useCallback(async (text: string, seconds = 30) => {
    await Clipboard.setStringAsync(text);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      await Clipboard.setStringAsync('');
      timerRef.current = null;
    }, seconds * 1000);
  }, []);

  const clearNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await Clipboard.setStringAsync('');
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { copyWithTimer, clearNow };
}

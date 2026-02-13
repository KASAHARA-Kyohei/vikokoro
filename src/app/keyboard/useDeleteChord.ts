import { useCallback, useEffect, useRef } from "react";

export function useDeleteChord(timeoutMs = 600) {
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consumeD = useCallback((): boolean => {
    if (pendingRef.current) {
      reset();
      return true;
    }

    pendingRef.current = true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      pendingRef.current = false;
      timerRef.current = null;
    }, timeoutMs);
    return false;
  }, [reset, timeoutMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    reset,
    consumeD,
  };
}

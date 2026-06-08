import { useCallback, useEffect, useRef } from "react";
import {
  resolveFoldChordKey,
  type FoldChordAction,
} from "./foldChord";

export function useFoldChord(timeoutMs = 600) {
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consume = useCallback(
    (key: string): "pending" | FoldChordAction | null => {
      const resolution = resolveFoldChordKey(pendingRef.current, key);
      pendingRef.current = resolution.nextPending;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (resolution.nextPending) {
        timerRef.current = window.setTimeout(() => {
          pendingRef.current = false;
          timerRef.current = null;
        }, timeoutMs);
      }

      if (!resolution.handled) return null;
      return resolution.action ?? "pending";
    },
    [timeoutMs],
  );

  useEffect(() => reset, [reset]);

  return { consume, reset };
}

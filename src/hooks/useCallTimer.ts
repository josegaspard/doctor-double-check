import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_DURATION_SECONDS = 60 * 60; // 1 hour

export function useCallTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsRunning(true);
    setSeconds(0);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= MAX_DURATION_SECONDS) {
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const timeRemaining = MAX_DURATION_SECONDS - seconds;
  const isNearEnd = timeRemaining <= 5 * 60; // 5 min warning

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return {
    seconds,
    timeElapsed: formatTime(seconds),
    timeRemaining,
    isNearEnd,
    isExpired: seconds >= MAX_DURATION_SECONDS,
    start,
    stop,
  };
}

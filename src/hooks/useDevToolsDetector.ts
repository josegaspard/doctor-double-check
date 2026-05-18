import { useEffect, useRef, useState } from 'react';
import { logFileAccess } from '@/lib/fileAccessLog';

interface UseDevToolsDetectorOpts {
  fileId?: string;
  bucket?: string;
  onOpen?: () => void;
}

/**
 * Best-effort DevTools detection.
 *
 * Strategies:
 *  1. Window outer/inner dimension delta — DevTools docked grows the chrome by
 *     >= 160px in either axis. Fast and reliable on Chrome/Edge/Brave/Firefox.
 *  2. Debugger trap with timing — if a debugger statement takes > 100ms to
 *     pass through, devtools is open and paused (catches undocked windows).
 *
 * Neither is bullet-proof (the user can disable it via DevTools settings or by
 * editing our JS), but combined they catch the casual 99%.
 *
 * When detected we:
 *  - Set state so consumers can pause video / blur content
 *  - Log a `download_attempt` entry to file_access_log (forensic trail)
 */
export function useDevToolsDetector(opts?: UseDevToolsDetectorOpts) {
  const [isOpen, setIsOpen] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const threshold = 160;
    let hasLogged = false;
    let opened = false;

    const fire = () => {
      if (!opened) {
        opened = true;
        setIsOpen(true);
      }
      const o = optsRef.current;
      if (!hasLogged) {
        hasLogged = true;
        if (o?.fileId) {
          logFileAccess({
            fileId: o.fileId,
            bucket: o.bucket,
            fileType: 'video',
            action: 'download_attempt',
            error: 'devtools_opened',
          });
        }
        o?.onOpen?.();
      }
    };

    const clear = () => {
      if (opened) {
        opened = false;
        setIsOpen(false);
      }
      hasLogged = false;
    };

    const checkSize = () => {
      const wDelta = window.outerWidth - window.innerWidth;
      const hDelta = window.outerHeight - window.innerHeight;
      if (wDelta > threshold || hDelta > threshold) fire();
      else clear();
    };

    const interval = setInterval(checkSize, 1000);
    checkSize();

    let timingTrapTimer: number | undefined;
    const timingTrap = () => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const elapsed = performance.now() - start;
      if (elapsed > 100) fire();
      timingTrapTimer = window.setTimeout(timingTrap, 5000);
    };
    if (import.meta.env?.PROD) {
      timingTrapTimer = window.setTimeout(timingTrap, 3000);
    }

    return () => {
      clearInterval(interval);
      if (timingTrapTimer !== undefined) clearTimeout(timingTrapTimer);
    };
  }, []);

  return isOpen;
}

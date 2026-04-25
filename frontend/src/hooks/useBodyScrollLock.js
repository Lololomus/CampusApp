import { useLayoutEffect, useRef } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';

export function useBodyScrollLock(active = true) {
  const lockedRef = useRef(false);

  useLayoutEffect(() => {
    if (active && !lockedRef.current) {
      lockBodyScroll();
      lockedRef.current = true;
    } else if (!active && lockedRef.current) {
      unlockBodyScroll({ restoreGuard: false });
      lockedRef.current = false;
    }

    return () => {
      if (lockedRef.current) {
        unlockBodyScroll();
        lockedRef.current = false;
      }
    };
  }, [active]);
}

import { useCallback, useEffect, useRef, useState } from 'react';

export const BOTTOM_SHEET_EXIT_MS = 320;
export const BOTTOM_SHEET_TRANSITION = 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)';

export function useBottomSheetModal({
  open = true,
  onClose,
  exitMs = BOTTOM_SHEET_EXIT_MS,
} = {}) {
  const [isOpen, setIsOpen] = useState(open);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open) {
      clearCloseTimer();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [clearCloseTimer, open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const requestClose = useCallback(() => {
    setIsOpen(false);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose?.();
    }, exitMs);
  }, [clearCloseTimer, exitMs, onClose]);

  return { isOpen, requestClose, setIsOpen };
}

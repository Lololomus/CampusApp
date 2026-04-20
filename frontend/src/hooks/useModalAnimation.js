// ===== FILE: frontend/src/hooks/useModalAnimation.js =====
// Единый контракт mount/unmount анимации для модалок.
// Паттерн взят с CreatePostModal.
//
// isMounted  — DOM-гейт: предотвращает рендер до монтирования.
// isVisible  — CSS-триггер: true через 20ms (enter-transition) / false при закрытии (exit).
// handleClose — запускает exit-анимацию и вызывает onClose через exitMs мс.

import { useCallback, useEffect, useState } from 'react';

// Длительность exit-анимации по типу модалки
export const SHEET_EXIT_MS = 300;   // bottom-sheet (translateY вниз)
export const SCREEN_EXIT_MS = 350;  // full-screen screen (translateX вправо)

/**
 * @param {Function} onClose  — коллбэк вызывается после завершения exit-анимации
 * @param {number}   exitMs   — длительность exit-анимации в мс
 * @returns {{ isMounted: boolean, isVisible: boolean, handleClose: Function }}
 */
export function useModalAnimation(onClose, exitMs = SHEET_EXIT_MS) {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, exitMs);
  }, [onClose, exitMs]);

  return { isMounted, isVisible, handleClose };
}

// ===== FILE: frontend/src/hooks/useSwipe.js =====
import { useCallback, useEffect, useRef } from 'react';

export const useSwipe = ({
  elementRef,
  onSwipeDown,
  onSwipeRight,
  onSwipeLeft,
  threshold = 100,
  isModal = false,
}) => {
  const startPos = useRef({ x: 0, y: 0 });
  const currentOffset = useRef({ x: 0, y: 0 });
  const isSwiping = useRef(false);
  const directionLocked = useRef(null);
  const isMouseDown = useRef(false);
  const removeGlobalMouseListeners = useRef(null);

  const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
  const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const clearGlobalMouseListeners = useCallback(() => {
    if (removeGlobalMouseListeners.current) {
      removeGlobalMouseListeners.current();
      removeGlobalMouseListeners.current = null;
    }
  }, []);

  const onMove = useCallback((e) => {
    if (!isSwiping.current) return;
    if (!e.touches && !isMouseDown.current) return;

    const deltaX = getX(e) - startPos.current.x;
    const deltaY = getY(e) - startPos.current.y;

    if (!directionLocked.current) {
      directionLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    let translateX = 0;
    let translateY = 0;

    if (isModal) {
      if (directionLocked.current === 'x') return;
      translateY = deltaY < 0 ? deltaY * 0.2 : deltaY;
    } else {
      if (directionLocked.current !== 'x') return;
      translateX = deltaX;
    }

    if (elementRef.current) {
      const rotate = isModal ? 0 : translateX * 0.05;
      elementRef.current.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotate}deg)`;
    }

    currentOffset.current = { x: translateX, y: translateY };
  }, [elementRef, isModal]);

  const onCancel = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      elementRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    }

    isSwiping.current = false;
    isMouseDown.current = false;
    directionLocked.current = null;
    currentOffset.current = { x: 0, y: 0 };
    clearGlobalMouseListeners();
  }, [clearGlobalMouseListeners, elementRef]);

  const onEnd = useCallback(() => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    isMouseDown.current = false;

    const { x, y } = currentOffset.current;

    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }

    let handled = false;

    if (isModal && y > threshold) {
      onSwipeDown?.();
      handled = true;
    } else if (!isModal && Math.abs(x) > threshold) {
      if (x > 0) onSwipeRight?.();
      else onSwipeLeft?.();
      handled = true;
    }

    if (!handled && elementRef.current) {
      elementRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    }

    directionLocked.current = null;
    currentOffset.current = { x: 0, y: 0 };
    clearGlobalMouseListeners();
  }, [clearGlobalMouseListeners, elementRef, isModal, onSwipeDown, onSwipeLeft, onSwipeRight, threshold]);

  const onStart = useCallback((e) => {
    const isTouchEvent = Boolean(e.touches);

    if (!isTouchEvent) {
      isMouseDown.current = true;
      if (e.cancelable) e.preventDefault();
    }

    startPos.current = { x: getX(e), y: getY(e) };
    isSwiping.current = true;
    directionLocked.current = null;
    currentOffset.current = { x: 0, y: 0 };

    if (elementRef.current) {
      elementRef.current.style.transition = 'none';
    }

    if (!isTouchEvent && typeof window !== 'undefined') {
      clearGlobalMouseListeners();
      const handleMouseMove = (event) => onMove(event);
      const handleMouseUp = () => onEnd();
      const handleWindowBlur = () => onCancel();

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('blur', handleWindowBlur);

      removeGlobalMouseListeners.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleWindowBlur);
      };
    }
  }, [clearGlobalMouseListeners, elementRef, onCancel, onEnd, onMove]);

  useEffect(() => () => clearGlobalMouseListeners(), [clearGlobalMouseListeners]);

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onTouchCancel: onCancel,
    onMouseDown: onStart,
    onMouseUp: onEnd,
  };
};

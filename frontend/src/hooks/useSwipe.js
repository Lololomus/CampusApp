// ===== FILE: frontend/src/hooks/useSwipe.js =====
import { useCallback, useEffect, useRef } from 'react';

export const useSwipe = ({
  elementRef,
  activationRef,
  activationWidth = 96,
  activationHeight = 44,
  activationDistance = 8,
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
  const smartSwipe = useRef({ pending: false, active: false, isTouch: false });
  const suppressNextClick = useRef(false);
  const suppressClickTimer = useRef(null);

  const getX = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
  const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);
  const getPoint = (e) => {
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return { x: e.clientX, y: e.clientY };
    }
    return null;
  };

  const isPointInActivationArea = useCallback((point) => {
    const node = activationRef?.current;
    if (!node || !point) return false;

    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const halfWidth = Math.max(rect.width, activationWidth) / 2;
    const halfHeight = Math.max(rect.height, activationHeight) / 2;

    return (
      point.x >= centerX - halfWidth &&
      point.x <= centerX + halfWidth &&
      point.y >= centerY - halfHeight &&
      point.y <= centerY + halfHeight
    );
  }, [activationHeight, activationRef, activationWidth]);

  const clearGlobalMouseListeners = useCallback(() => {
    if (removeGlobalMouseListeners.current) {
      removeGlobalMouseListeners.current();
      removeGlobalMouseListeners.current = null;
    }
  }, []);

  const clearSuppressClickTimer = useCallback(() => {
    if (suppressClickTimer.current) {
      clearTimeout(suppressClickTimer.current);
      suppressClickTimer.current = null;
    }
  }, []);

  const releaseClickSuppressionSoon = useCallback(() => {
    clearSuppressClickTimer();
    suppressClickTimer.current = setTimeout(() => {
      suppressNextClick.current = false;
      suppressClickTimer.current = null;
    }, 450);
  }, [clearSuppressClickTimer]);

  const onMove = useCallback((e) => {
    if (!isSwiping.current) return;
    if (!e.touches && !isMouseDown.current) return;
    if (isModal) e.stopPropagation();

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

  const onCancel = useCallback((e) => {
    if (isModal) e?.stopPropagation?.();

    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      elementRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    }

    isSwiping.current = false;
    isMouseDown.current = false;
    directionLocked.current = null;
    currentOffset.current = { x: 0, y: 0 };
    clearGlobalMouseListeners();
  }, [clearGlobalMouseListeners, elementRef, isModal]);

  const resetSmartSwipe = useCallback(() => {
    smartSwipe.current = { pending: false, active: false, isTouch: false };
    isSwiping.current = false;
    isMouseDown.current = false;
    directionLocked.current = null;
    currentOffset.current = { x: 0, y: 0 };
  }, []);

  const onEnd = useCallback((e) => {
    if (isModal) e?.stopPropagation?.();
    if (!isSwiping.current) return;
    isSwiping.current = false;
    isMouseDown.current = false;

    const { x, y } = currentOffset.current;

    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    }

    let handled = false;

    if (isModal && y > threshold) {
      const swipeResult = onSwipeDown?.();
      handled = swipeResult !== false;
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

  const onSmartStart = useCallback((e, isTouch) => {
    if (!activationRef?.current) return;
    if (!isTouch && e.button !== 0) return;

    const point = getPoint(e);
    if (!isPointInActivationArea(point)) return;

    startPos.current = point;
    currentOffset.current = { x: 0, y: 0 };
    directionLocked.current = null;
    smartSwipe.current = { pending: true, active: false, isTouch };
    isMouseDown.current = !isTouch;
  }, [activationRef, isPointInActivationArea]);

  const activateSmartSwipe = useCallback((e) => {
    smartSwipe.current.active = true;
    smartSwipe.current.pending = false;
    isSwiping.current = true;
    directionLocked.current = isModal ? 'y' : 'x';
    suppressNextClick.current = true;
    clearSuppressClickTimer();

    if (elementRef.current) {
      elementRef.current.style.transition = 'none';
    }

    if (e.cancelable) e.preventDefault();
    e.stopPropagation?.();
  }, [clearSuppressClickTimer, elementRef, isModal]);

  const onSmartMove = useCallback((e) => {
    const state = smartSwipe.current;
    if (!state.pending && !state.active) return;
    if (Boolean(e.touches) !== state.isTouch) return;

    const point = getPoint(e);
    if (!point) return;

    const deltaX = point.x - startPos.current.x;
    const deltaY = point.y - startPos.current.y;

    if (!state.active) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (Math.max(absX, absY) < activationDistance) return;

      const isModalDrag = isModal && deltaY > 0 && absY > absX;
      const isCardDrag = !isModal && absX > absY;
      if (!isModalDrag && !isCardDrag) {
        resetSmartSwipe();
        return;
      }

      activateSmartSwipe(e);
    }

    if (e.cancelable) e.preventDefault();
    e.stopPropagation?.();
    onMove(e);
  }, [activateSmartSwipe, activationDistance, isModal, onMove, resetSmartSwipe]);

  const onSmartEnd = useCallback((e) => {
    const state = smartSwipe.current;
    if (!state.pending && !state.active) return;
    if (Boolean(e.touches) !== state.isTouch && e.touches?.length > 0) return;

    if (state.active) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation?.();
      onEnd(e);
      smartSwipe.current = { pending: false, active: false, isTouch: false };
      releaseClickSuppressionSoon();
      return;
    }

    resetSmartSwipe();
  }, [onEnd, releaseClickSuppressionSoon, resetSmartSwipe]);

  const onSmartCancel = useCallback((e) => {
    if (!smartSwipe.current.pending && !smartSwipe.current.active) return;
    const wasActive = smartSwipe.current.active;
    onCancel(e);
    smartSwipe.current = { pending: false, active: false, isTouch: false };
    if (wasActive) releaseClickSuppressionSoon();
  }, [onCancel, releaseClickSuppressionSoon]);

  const onSmartClick = useCallback((e) => {
    if (!suppressNextClick.current) return;
    clearSuppressClickTimer();
    suppressNextClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, [clearSuppressClickTimer]);

  const onStart = useCallback((e) => {
    if (isModal) e.stopPropagation();
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
  }, [clearGlobalMouseListeners, elementRef, isModal, onCancel, onEnd, onMove]);

  useEffect(() => {
    if (!activationRef?.current || typeof document === 'undefined') return undefined;

    const handleTouchStart = (event) => onSmartStart(event, true);
    const handleTouchMove = (event) => onSmartMove(event);
    const handleTouchEnd = (event) => onSmartEnd(event);
    const handleTouchCancel = (event) => onSmartCancel(event);
    const handleMouseDown = (event) => onSmartStart(event, false);
    const handleMouseMove = (event) => onSmartMove(event);
    const handleMouseUp = (event) => onSmartEnd(event);
    const handleClick = (event) => onSmartClick(event);
    const capture = { capture: true };
    const touchMoveCapture = { capture: true, passive: false };

    document.addEventListener('touchstart', handleTouchStart, capture);
    document.addEventListener('touchmove', handleTouchMove, touchMoveCapture);
    document.addEventListener('touchend', handleTouchEnd, capture);
    document.addEventListener('touchcancel', handleTouchCancel, capture);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, capture);
      document.removeEventListener('touchmove', handleTouchMove, touchMoveCapture);
      document.removeEventListener('touchend', handleTouchEnd, capture);
      document.removeEventListener('touchcancel', handleTouchCancel, capture);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('click', handleClick, true);
    };
  }, [activationRef, onSmartCancel, onSmartClick, onSmartEnd, onSmartMove, onSmartStart]);

  useEffect(() => () => {
    clearGlobalMouseListeners();
    clearSuppressClickTimer();
    resetSmartSwipe();
  }, [clearGlobalMouseListeners, clearSuppressClickTimer, resetSmartSwipe]);

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onTouchCancel: onCancel,
    onMouseDown: onStart,
    onMouseUp: onEnd,
  };
};

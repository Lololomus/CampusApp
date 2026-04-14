// ===== FILE: frontend/src/hooks/useEdgeSwipeBack.js =====
import { useEffect, useRef, useState, useCallback } from 'react';
import { isIOS } from '../utils/platform';
import { hapticFeedback } from '../utils/telegram';

export const useEdgeSwipeBack = ({
  onBack,
  onInterceptBack,
  disabled = false,
  edgeZone = 28,
  threshold = 90,
}) => {
  const wrapperRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Держим onBack в рефе — не пересоздаём слушатели при каждом рендере
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const onInterceptBackRef = useRef(onInterceptBack);
  onInterceptBackRef.current = onInterceptBack;

  const trackingRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dirLocked: null,
    currentX: 0,
  });

  const setTransform = useCallback((tx, withTransition = false) => {
    const el = wrapperRef.current;
    if (!el) return;
    if (withTransition) {
      el.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
    } else {
      el.style.transition = 'none';
    }
    el.style.transform = tx === 0 ? '' : `translateX(${tx}px)`;
  }, []);

  const cancelTracking = useCallback(() => {
    const t = trackingRef.current;
    if (!t.active) return;
    t.active = false;
    t.dirLocked = null;
    t.currentX = 0;
    setIsDragging(false);
    setTransform(0, true);
  }, [setTransform]);

  useEffect(() => {
    if (!isIOS() || disabled) return;

    const handleTouchMove = (e) => {
      const t = trackingRef.current;
      if (!t.active) return;

      // Мультитач — отменяем
      if (e.touches.length !== 1) {
        cancelTracking();
        removeDynamicListeners();
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - t.startX;
      const deltaY = touch.clientY - t.startY;
      const absDX = Math.abs(deltaX);
      const absDY = Math.abs(deltaY);

      // Direction lock — после 8px движения
      if (!t.dirLocked && (absDX > 8 || absDY > 8)) {
        t.dirLocked = absDX >= absDY ? 'horizontal' : 'vertical';
      }

      // Вертикальный скролл — отменяем свайп
      if (t.dirLocked === 'vertical') {
        cancelTracking();
        removeDynamicListeners();
        return;
      }

      // Горизонталь зафиксирована — блокируем вертикальный скролл
      if (t.dirLocked === 'horizontal') {
        e.preventDefault();
      }

      if (!t.dirLocked) return;

      // Только движение правее
      const tx = Math.max(0, deltaX);
      t.currentX = tx;

      const el = wrapperRef.current;
      if (el) {
        el.style.transition = 'none';
        el.style.transform = `translateX(${tx}px)`;
      }
    };

    const handleTouchEnd = () => {
      const t = trackingRef.current;
      if (!t.active) return;

      const progress = t.currentX / threshold;

      if (progress >= 1) {
        // Позволяем экрану перехватить edge-back (например, шаг назад внутри вложенного экрана)
        const isIntercepted = onInterceptBackRef.current?.() === true;
        if (isIntercepted) {
          cancelTracking();
          removeDynamicListeners();
          return;
        }

        // Порог достигнут — анимируем выход и вызываем onBack
        hapticFeedback('light');
        const el = wrapperRef.current;
        if (el) {
          el.style.transition = 'transform 0.28s cubic-bezier(0.4, 0, 0.6, 1)';
          el.style.transform = 'translateX(var(--app-fixed-width))';
        }
        t.active = false;
        t.dirLocked = null;
        t.currentX = 0;
        setIsDragging(false);
        setTimeout(() => {
          onBackRef.current?.();
        }, 280);
      } else {
        // Не дотянули — пружинный возврат
        cancelTracking();
      }

      removeDynamicListeners();
    };

    const handleTouchCancel = () => {
      cancelTracking();
      removeDynamicListeners();
    };

    const removeDynamicListeners = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };

    const handleTouchStart = (e) => {
      // Только одно касание
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];

      // Только от левого края
      if (touch.clientX > edgeZone) return;

      // Игнорируем если внутри галереи/карусели
      if (e.target?.closest?.('[data-no-edge-swipe]')) return;

      // Отвечает только самый верхний EdgeSwipeBack (по z-index)
      // Если под пальцем есть другой EdgeSwipeBack с более высоким z-index — уступаем ему
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const topEdgeWrapper = document.elementsFromPoint(touch.clientX, touch.clientY)
        .find(el => el.hasAttribute('data-edge-swipe-wrapper'));
      if (topEdgeWrapper !== wrapper) return;

      trackingRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        dirLocked: null,
        currentX: 0,
      };

      setIsDragging(true);

      // Динамически вешаем move/end/cancel
      // passive: false чтобы можно было вызвать preventDefault при горизонтальном свайпе
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      document.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    };

    document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      // На случай unmount во время активного свайпа
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      // Сбрасываем transform если компонент размонтирован в середине свайпа
      trackingRef.current.active = false;
    };
  }, [disabled, edgeZone, threshold, cancelTracking]);

  return { wrapperRef, isDragging };
};

// ===== FILE: usePullToRefresh.js =====

import { useState, useEffect, useRef } from 'react';
import { PULL_TO_REFRESH_THRESHOLD } from '../constants/layoutConstants';
import { hapticFeedback } from '../utils/telegram';

// Максимальное визуальное смещение индикатора (px)
const DISPLAY_MAX = 44;

/**
 * Хук pull-to-refresh с визуальным прогрессом.
 * @param {Object} opts
 * @param {Function} opts.onRefresh  — коллбек обновления (вызывается один раз при достижении порога)
 * @param {boolean}  opts.loading    — текущее состояние загрузки (отслеживаем завершение refresh)
 * @param {boolean}  [opts.disabled] — отключить логику
 * @returns {{ pullProgress: number, isRefreshing: boolean, snapping: boolean }}
 */
export function usePullToRefresh({ onRefresh, loading, disabled = false }) {
  const [pullProgress, setPullProgress] = useState(0); // 0..1
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const startYRef = useRef(0);
  const lockRef = useRef(false);
  const rafRef = useRef(null);
  const prevLoadingRef = useRef(loading);

  // Следим за переходом loading true→false — скрываем индикатор после завершения
  useEffect(() => {
    if (prevLoadingRef.current && !loading && isRefreshing) {
      const t = setTimeout(() => {
        setIsRefreshing(false);
        setSnapping(true);
        setPullProgress(0);
        lockRef.current = false;
        const t2 = setTimeout(() => setSnapping(false), 420);
        return () => clearTimeout(t2);
      }, 300);
      return () => clearTimeout(t);
    }
    prevLoadingRef.current = loading;
  }, [loading, isRefreshing]);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e) => {
      if (lockRef.current) return;
      startYRef.current = window.scrollY === 0 ? e.touches[0].clientY : 0;
      setSnapping(false);
    };

    const handleTouchMove = (e) => {
      if (startYRef.current === 0 || lockRef.current || window.scrollY !== 0) return;

      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setPullProgress(0));
        return;
      }

      // Rubber-band: сопротивление нарастает — смещение логарифмическое
      const damped = Math.min(delta * 0.42, DISPLAY_MAX);
      const progress = damped / DISPLAY_MAX;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setPullProgress(progress));

      if (delta > PULL_TO_REFRESH_THRESHOLD && !lockRef.current) {
        lockRef.current = true;
        hapticFeedback('medium');
        setIsRefreshing(true);
        setPullProgress(1);
        onRefresh();
      }
    };

    const handleTouchEnd = () => {
      if (lockRef.current) return;
      setSnapping(true);
      setPullProgress(0);
      setTimeout(() => setSnapping(false), 420);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [disabled, onRefresh]);

  return { pullProgress, isRefreshing, snapping, DISPLAY_MAX };
}

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const MAIN_SCROLL_TABS = new Set(['feed', 'market', 'profile']);

const getWindowScrollY = () => {
  if (typeof window === 'undefined') return 0;
  return Math.max(
    0,
    window.scrollY
      || document.documentElement?.scrollTop
      || document.body?.scrollTop
      || 0
  );
};

export function useMainTabScrollMemory(activeTab) {
  const positionsRef = useRef({ feed: 0, market: 0, profile: 0 });
  const activeTabRef = useRef(activeTab);
  const isRestoringRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const restoreTimersRef = useRef([]);

  const clearRestoreTimers = useCallback(() => {
    restoreTimersRef.current.forEach((timer) => clearTimeout(timer));
    restoreTimersRef.current = [];
  }, []);

  const saveScrollForTab = useCallback((tab = activeTabRef.current) => {
    if (!MAIN_SCROLL_TABS.has(tab)) return;
    positionsRef.current[tab] = getWindowScrollY();
  }, []);

  const setSavedScroll = useCallback((tab, value) => {
    if (!MAIN_SCROLL_TABS.has(tab)) return;
    const nextValue = Number(value);
    positionsRef.current[tab] = Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0;
  }, []);

  useLayoutEffect(() => {
    clearRestoreTimers();
    activeTabRef.current = activeTab;
    if (!MAIN_SCROLL_TABS.has(activeTab)) return undefined;

    const nextScrollY = positionsRef.current[activeTab] || 0;
    if (Math.abs(getWindowScrollY() - nextScrollY) <= 1) return undefined;

    const restoreToken = restoreTokenRef.current + 1;
    restoreTokenRef.current = restoreToken;
    isRestoringRef.current = true;

    const restore = () => {
      if (restoreTokenRef.current !== restoreToken) return;
      window.scrollTo(0, nextScrollY);
      if (Math.abs(getWindowScrollY() - nextScrollY) <= 1) {
        clearRestoreTimers();
        isRestoringRef.current = false;
      }
    };

    restore();
    if (!isRestoringRef.current) return undefined;

    [50, 150, 300, 600, 1000].forEach((delay) => {
      const timer = setTimeout(restore, delay);
      restoreTimersRef.current.push(timer);
    });

    const finishTimer = setTimeout(() => {
      if (restoreTokenRef.current === restoreToken) {
        isRestoringRef.current = false;
        clearRestoreTimers();
      }
    }, 1100);
    restoreTimersRef.current.push(finishTimer);

    return () => {
      clearRestoreTimers();
      isRestoringRef.current = false;
    };
  }, [activeTab, clearRestoreTimers]);

  useEffect(() => {
    const handleScroll = () => {
      if (isRestoringRef.current) return;
      saveScrollForTab(activeTabRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', handleScroll);
    };
  }, [saveScrollForTab]);

  useEffect(() => {
    const cancelRestore = () => {
      if (!isRestoringRef.current) return;
      restoreTokenRef.current += 1;
      clearRestoreTimers();
      isRestoringRef.current = false;
      saveScrollForTab(activeTabRef.current);
    };

    window.addEventListener('wheel', cancelRestore, { passive: true });
    window.addEventListener('touchstart', cancelRestore, { passive: true });
    window.addEventListener('keydown', cancelRestore);

    return () => {
      window.removeEventListener('wheel', cancelRestore);
      window.removeEventListener('touchstart', cancelRestore);
      window.removeEventListener('keydown', cancelRestore);
    };
  }, [clearRestoreTimers, saveScrollForTab]);

  return { saveCurrentScroll: saveScrollForTab, setSavedScroll };
}

// ===== FILE: frontend/src/components/shared/telegram/useTelegramScreen.js =====

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTelegramScreenRegistry } from './TelegramScreenProvider';

function useStableEvent(handler) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return useCallback((...args) => {
    if (typeof handlerRef.current === 'function') {
      handlerRef.current(...args);
    }
  }, []);
}

function normalizeConfig(params) {
  if (!params.id) return null;

  return {
    id: params.id,
    title: params.title,
    priority: params.priority,
    back: {
      visible: params.backVisible,
      onClick: params.hasBackOnClick ? params.backOnClick : undefined,
    },
    main: {
      visible: params.mainVisible,
      text: params.mainText,
      onClick: params.hasMainOnClick ? params.mainOnClick : undefined,
      enabled: params.mainEnabled,
      loading: params.mainLoading,
      color: params.mainColor,
    },
    secondary: {
      visible: params.secondaryVisible,
      text: params.secondaryText,
      onClick: params.hasSecondaryOnClick ? params.secondaryOnClick : undefined,
      enabled: params.secondaryEnabled,
      loading: params.secondaryLoading,
      color: params.secondaryColor,
      position: params.secondaryPosition,
    },
  };
}

export function useTelegramScreen(config) {
  const registry = useTelegramScreenRegistry();
  const ownerRef = useRef(Symbol('telegram-screen-owner'));
  const normalizedRef = useRef(null);

  const id = config?.id;
  const title = config?.title;
  const priority = config?.priority ?? 0;

  const backVisible = Boolean(config?.back?.visible);
  const hasBackOnClick = typeof config?.back?.onClick === 'function';
  const backOnClick = useStableEvent(config?.back?.onClick);

  const mainVisible = Boolean(config?.main?.visible);
  const mainText = config?.main?.text || '';
  const hasMainOnClick = typeof config?.main?.onClick === 'function';
  const mainOnClick = useStableEvent(config?.main?.onClick);
  const mainEnabled = config?.main?.enabled !== false;
  const mainLoading = Boolean(config?.main?.loading);
  const mainColor = config?.main?.color;

  const secondaryVisible = Boolean(config?.secondary?.visible);
  const secondaryText = config?.secondary?.text || '';
  const hasSecondaryOnClick = typeof config?.secondary?.onClick === 'function';
  const secondaryOnClick = useStableEvent(config?.secondary?.onClick);
  const secondaryEnabled = config?.secondary?.enabled !== false;
  const secondaryLoading = Boolean(config?.secondary?.loading);
  const secondaryColor = config?.secondary?.color;
  const secondaryPosition = config?.secondary?.position;

  const normalized = useMemo(() => {
    return normalizeConfig({
      id,
      title,
      priority,
      backVisible,
      hasBackOnClick,
      backOnClick,
      mainVisible,
      mainText,
      hasMainOnClick,
      mainOnClick,
      mainEnabled,
      mainLoading,
      mainColor,
      secondaryVisible,
      secondaryText,
      hasSecondaryOnClick,
      secondaryOnClick,
      secondaryEnabled,
      secondaryLoading,
      secondaryColor,
      secondaryPosition,
    });
  }, [
    id,
    title,
    priority,
    backVisible,
    hasBackOnClick,
    backOnClick,
    mainVisible,
    mainText,
    hasMainOnClick,
    mainOnClick,
    mainEnabled,
    mainLoading,
    mainColor,
    secondaryVisible,
    secondaryText,
    hasSecondaryOnClick,
    secondaryOnClick,
    secondaryEnabled,
    secondaryLoading,
    secondaryColor,
    secondaryPosition,
  ]);

  const screenId = normalized?.id;
  const registerScreen = registry?.registerScreen;
  const updateScreen = registry?.updateScreen;
  const unregisterScreen = registry?.unregisterScreen;

  useEffect(() => {
    normalizedRef.current = normalized;
  }, [normalized]);

  useEffect(() => {
    if (!registerScreen || !unregisterScreen || !screenId) return undefined;

    const owner = ownerRef.current;
    registerScreen(screenId, normalizedRef.current, owner);

    return () => {
      unregisterScreen(screenId, owner);
    };
  }, [registerScreen, unregisterScreen, screenId]);

  useEffect(() => {
    if (!updateScreen || !screenId) return;
    updateScreen(screenId, normalized, ownerRef.current);
  }, [updateScreen, screenId, normalized]);
}

export default useTelegramScreen;

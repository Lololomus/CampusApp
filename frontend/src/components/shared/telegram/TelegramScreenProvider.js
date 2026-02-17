// ===== FILE: frontend/src/components/shared/telegram/TelegramScreenProvider.js =====

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  isTelegramSDKAvailable,
  setBackButton,
  setMainButton,
  setSecondaryButton,
  resetAllButtons,
} from '../../../utils/telegram';
import DevTelegramActionBar from './DevTelegramActionBar';

const TelegramScreenContext = createContext(null);

function normalizeButtonConfig(button) {
  return {
    visible: Boolean(button?.visible),
    text: button?.text || '',
    enabled: button?.enabled !== false,
    loading: Boolean(button?.loading),
    color: button?.color || '',
    position: button?.position || '',
    onClick: button?.onClick,
  };
}

function areScreenConfigsEqual(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;

  const leftBack = normalizeButtonConfig(left.back);
  const rightBack = normalizeButtonConfig(right.back);
  const leftMain = normalizeButtonConfig(left.main);
  const rightMain = normalizeButtonConfig(right.main);
  const leftSecondary = normalizeButtonConfig(left.secondary);
  const rightSecondary = normalizeButtonConfig(right.secondary);

  return (
    left.id === right.id &&
    (left.title || '') === (right.title || '') &&
    (left.priority || 0) === (right.priority || 0) &&
    leftBack.visible === rightBack.visible &&
    leftBack.text === rightBack.text &&
    leftBack.enabled === rightBack.enabled &&
    leftBack.loading === rightBack.loading &&
    leftBack.color === rightBack.color &&
    leftBack.position === rightBack.position &&
    leftBack.onClick === rightBack.onClick &&
    leftMain.visible === rightMain.visible &&
    leftMain.text === rightMain.text &&
    leftMain.enabled === rightMain.enabled &&
    leftMain.loading === rightMain.loading &&
    leftMain.color === rightMain.color &&
    leftMain.position === rightMain.position &&
    leftMain.onClick === rightMain.onClick &&
    leftSecondary.visible === rightSecondary.visible &&
    leftSecondary.text === rightSecondary.text &&
    leftSecondary.enabled === rightSecondary.enabled &&
    leftSecondary.loading === rightSecondary.loading &&
    leftSecondary.color === rightSecondary.color &&
    leftSecondary.position === rightSecondary.position &&
    leftSecondary.onClick === rightSecondary.onClick
  );
}

function resolveActiveScreen(map) {
  let active = null;

  for (const value of map.values()) {
    if (!active) {
      active = value;
      continue;
    }

    const activePriority = active.config?.priority || 0;
    const valuePriority = value.config?.priority || 0;

    if (valuePriority > activePriority) {
      active = value;
      continue;
    }

    if (valuePriority === activePriority && value.seq > active.seq) {
      active = value;
    }
  }

  return active;
}

export function TelegramScreenProvider({ children }) {
  const screensRef = useRef(new Map());
  const seqRef = useRef(0);
  const [revision, setRevision] = useState(0);

  const registerScreen = useCallback((id, config, owner) => {
    if (!id) return;

    const existing = screensRef.current.get(id);
    if (existing && existing.owner === owner && areScreenConfigsEqual(existing.config, config)) {
      return;
    }

    const nextEntry = {
      id,
      owner,
      seq: existing?.seq ?? ++seqRef.current,
      config,
    };

    screensRef.current.set(id, nextEntry);
    setRevision((value) => value + 1);
  }, []);

  const updateScreen = useCallback((id, config, owner) => {
    if (!id) return;

    const existing = screensRef.current.get(id);
    if (!existing) {
      registerScreen(id, config, owner);
      return;
    }

    if (existing.owner !== owner) return;
    if (areScreenConfigsEqual(existing.config, config)) return;

    screensRef.current.set(id, {
      ...existing,
      config,
    });
    setRevision((value) => value + 1);
  }, [registerScreen]);

  const unregisterScreen = useCallback((id, owner) => {
    if (!id) return;

    const existing = screensRef.current.get(id);
    if (!existing || existing.owner !== owner) return;

    screensRef.current.delete(id);
    setRevision((value) => value + 1);
  }, []);

  const activeScreen = useMemo(() => {
    void revision;
    return resolveActiveScreen(screensRef.current);
  }, [revision]);

  const isTelegram = isTelegramSDKAvailable();

  useEffect(() => {
    if (!isTelegram) return;

    const config = activeScreen?.config;

    if (!config) {
      resetAllButtons();
      return;
    }

    setBackButton(config.back || { visible: false });
    setMainButton(config.main || { visible: false });
    setSecondaryButton(config.secondary || { visible: false });
  }, [activeScreen, isTelegram]);

  useEffect(() => {
    return () => {
      resetAllButtons();
    };
  }, []);

  const value = useMemo(() => {
    return {
      registerScreen,
      updateScreen,
      unregisterScreen,
      activeScreen: activeScreen?.config || null,
      isTelegram,
    };
  }, [activeScreen, isTelegram, registerScreen, unregisterScreen, updateScreen]);

  return (
    <TelegramScreenContext.Provider value={value}>
      {children}
      {!isTelegram && (
        <DevTelegramActionBar
          main={activeScreen?.config?.main}
          secondary={activeScreen?.config?.secondary}
        />
      )}
    </TelegramScreenContext.Provider>
  );
}

export function useTelegramScreenRegistry() {
  return useContext(TelegramScreenContext);
}

export default TelegramScreenProvider;

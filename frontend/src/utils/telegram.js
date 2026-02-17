// ===== FILE: frontend/src/utils/telegram.js =====

const listeners = {
  back: null,
  main: null,
  secondary: null,
};

function detachListener(button, key) {
  const listener = listeners[key];
  if (!listener || !button?.offClick) return;
  try {
    button.offClick(listener);
  } catch (error) {
    console.error(`Telegram ${key} offClick failed:`, error);
  } finally {
    listeners[key] = null;
  }
}

function attachListener(button, key, handler) {
  if (!button?.onClick || typeof handler !== 'function') return;
  detachListener(button, key);
  try {
    button.onClick(handler);
    listeners[key] = handler;
  } catch (error) {
    console.error(`Telegram ${key} onClick failed:`, error);
  }
}

function setButtonVisibility(button, visible) {
  if (!button) return;
  if (visible) {
    button.show?.();
  } else {
    button.hide?.();
  }
}

function setButtonState(button, enabled, loading) {
  if (!button) return;

  if (enabled === false) {
    button.disable?.();
  } else {
    button.enable?.();
  }

  if (loading) {
    button.showProgress?.();
  } else {
    button.hideProgress?.();
  }
}

function setButtonText(button, text) {
  if (!button || typeof text !== 'string') return;
  button.setText?.(text);
}

function applyButtonParams(button, params) {
  if (!button?.setParams || !params) return;
  try {
    button.setParams(params);
  } catch (error) {
    console.error('Telegram button setParams failed:', error);
  }
}

export function getTelegramWebApp() {
  return window?.Telegram?.WebApp || null;
}

export function isTelegramSDKAvailable() {
  const tg = getTelegramWebApp();
  return Boolean(tg && typeof tg.ready === 'function');
}

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (!tg) {
    console.warn('Telegram WebApp SDK not found. Running in browser mode.');
    return;
  }

  tg.ready?.();
  tg.expand?.();

  const root = document.documentElement;
  root.style.setProperty('--tg-theme-bg-color', tg.themeParams?.bg_color || '#1a1a1a');
  root.style.setProperty('--tg-theme-text-color', tg.themeParams?.text_color || '#ffffff');
}

export function getInitData() {
  return getTelegramWebApp()?.initData || '';
}

export function getTelegramUser() {
  const user = getTelegramWebApp()?.initDataUnsafe?.user;
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    username: user.username,
    photoUrl: user.photo_url || null,
  };
}

export function hapticFeedback(type = 'light') {
  const tg = getTelegramWebApp();
  tg?.HapticFeedback?.impactOccurred?.(type);
}

export function setBackButton(config = {}) {
  const tg = getTelegramWebApp();
  const button = tg?.BackButton;
  if (!button) return false;

  const { visible = false, onClick } = config;
  detachListener(button, 'back');
  setButtonVisibility(button, visible);

  if (visible && typeof onClick === 'function') {
    attachListener(button, 'back', onClick);
  }

  return true;
}

export function setMainButton(config = {}) {
  const tg = getTelegramWebApp();
  const button = tg?.MainButton;
  if (!button) return false;

  const {
    visible = false,
    text = '',
    onClick,
    enabled = true,
    loading = false,
    color,
  } = config;

  detachListener(button, 'main');

  if (!visible) {
    setButtonVisibility(button, false);
    setButtonState(button, true, false);
    return true;
  }

  setButtonText(button, text);
  applyButtonParams(button, color ? { color } : null);
  setButtonState(button, enabled, loading);
  setButtonVisibility(button, true);

  if (typeof onClick === 'function') {
    attachListener(button, 'main', onClick);
  }

  return true;
}

export function setSecondaryButton(config = {}) {
  const tg = getTelegramWebApp();
  const button = tg?.SecondaryButton;
  if (!button) return false;

  const {
    visible = false,
    text = '',
    onClick,
    enabled = true,
    loading = false,
    color,
    position,
  } = config;

  detachListener(button, 'secondary');

  if (!visible) {
    setButtonVisibility(button, false);
    setButtonState(button, true, false);
    return true;
  }

  setButtonText(button, text);
  applyButtonParams(button, {
    ...(color ? { color } : {}),
    ...(position ? { position } : {}),
  });
  setButtonState(button, enabled, loading);
  setButtonVisibility(button, true);

  if (typeof onClick === 'function') {
    attachListener(button, 'secondary', onClick);
  }

  return true;
}

export function resetAllButtons() {
  setBackButton({ visible: false });
  setMainButton({ visible: false });
  setSecondaryButton({ visible: false });
}

// Backward-compatible wrappers
export function showBackButton(onClick) {
  setBackButton({ visible: true, onClick });
}

export function hideBackButton() {
  setBackButton({ visible: false });
}

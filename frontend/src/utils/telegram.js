// ===== FILE: frontend/src/utils/telegram.js =====

const listeners = {
  back: null,
  main: null,
  secondary: null,
};
let telegramEventsBound = false;
const IMPACT_STYLES = new Set(['light', 'medium', 'heavy', 'rigid', 'soft']);
const NOTIFICATION_TYPES = new Set(['success', 'warning', 'error']);

function toPx(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric}px` : '0px';
}

function syncThemeVariables(tg) {
  const root = document.documentElement;
  const params = tg.themeParams || {};

  root.style.setProperty('--tg-theme-bg-color', params.bg_color || '#1a1a1a');
  root.style.setProperty('--tg-theme-text-color', params.text_color || '#ffffff');
  root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color || '#1f1f1f');
  root.style.setProperty('--tg-theme-hint-color', params.hint_color || '#8e8e93');
  root.style.setProperty('--tg-theme-link-color', params.link_color || '#6ab2f2');
  root.style.setProperty('--tg-theme-button-color', params.button_color || '#2ea6ff');
  root.style.setProperty('--tg-theme-button-text-color', params.button_text_color || '#ffffff');

  try {
    tg.setHeaderColor?.('bg_color');
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram setHeaderColor failed:', error);
  }

  try {
    tg.setBackgroundColor?.(params.bg_color || '#1a1a1a');
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram setBackgroundColor failed:', error);
  }

  try {
    tg.setBottomBarColor?.(
      params.bottom_bar_bg_color || params.secondary_bg_color || params.bg_color || '#1a1a1a'
    );
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram setBottomBarColor failed:', error);
  }
}

function syncViewportVariables(tg) {
  const root = document.documentElement;
  const viewportHeight = Number(tg.viewportHeight || window.innerHeight || 0);
  const viewportStableHeight = Number(tg.viewportStableHeight || viewportHeight || 0);

  root.style.setProperty('--tg-app-viewport-height', toPx(viewportHeight));
  root.style.setProperty('--tg-app-viewport-stable-height', toPx(viewportStableHeight));
}

function syncSafeAreaVariables(tg) {
  const root = document.documentElement;
  const safeAreaInset = tg.safeAreaInset || {};
  const contentSafeAreaInset = tg.contentSafeAreaInset || {};

  root.style.setProperty('--tg-safe-area-top', toPx(safeAreaInset.top));
  root.style.setProperty('--tg-safe-area-right', toPx(safeAreaInset.right));
  root.style.setProperty('--tg-safe-area-bottom', toPx(safeAreaInset.bottom));
  root.style.setProperty('--tg-safe-area-left', toPx(safeAreaInset.left));

  root.style.setProperty('--tg-content-safe-area-top', toPx(contentSafeAreaInset.top));
  root.style.setProperty('--tg-content-safe-area-right', toPx(contentSafeAreaInset.right));
  root.style.setProperty('--tg-content-safe-area-bottom', toPx(contentSafeAreaInset.bottom));
  root.style.setProperty('--tg-content-safe-area-left', toPx(contentSafeAreaInset.left));
}

function bindTelegramEvents(tg) {
  if (telegramEventsBound || typeof tg.onEvent !== 'function') return;

  tg.onEvent('themeChanged', () => {
    syncThemeVariables(tg);
  });

  tg.onEvent('viewportChanged', () => {
    syncViewportVariables(tg);
  });

  tg.onEvent('safeAreaChanged', () => {
    syncSafeAreaVariables(tg);
  });

  tg.onEvent('contentSafeAreaChanged', () => {
    syncSafeAreaVariables(tg);
  });

  telegramEventsBound = true;
}

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

// Вычисляет luma hex-цвета и возвращает контрастный текст (#000 или #fff)
function contrastTextColor(hex) {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.5 ? '#000000' : '#ffffff';
}

function applyButtonParams(button, params) {
  if (!button?.setParams || !params) return;
  try {
    const enriched = params.color
      ? { ...params, text_color: params.text_color || contrastTextColor(params.color) }
      : params;
    button.setParams(enriched);
  } catch (error) {
    console.error('Telegram button setParams failed:', error);
  }
}

export function getTelegramWebApp() {
  return window?.Telegram?.WebApp || null;
}

export function isTelegramSDKAvailable() {
  const tg = getTelegramWebApp();
  if (!tg || typeof tg.ready !== 'function') return false;

  // In обычном браузере telegram-web-app.js может быть загружен,
  // но без реального Mini App-контекста (кнопки не отрисуются нативно).
  const hasInitData =
    typeof tg.initData === 'string' && tg.initData.trim().length > 0;
  const hasUser = Boolean(tg.initDataUnsafe?.user?.id);
  const launchParams = `${window?.location?.search || ''}${window?.location?.hash || ''}`;
  const hasTelegramLaunchParams = /tgWebApp/i.test(launchParams);

  return hasInitData || hasUser || hasTelegramLaunchParams;
}

export function setVerticalSwipesEnabled(enabled = true) {
  const tg = getTelegramWebApp();
  if (!tg) return false;

  try {
    if (enabled) {
      tg.enableVerticalSwipes?.();
    } else {
      tg.disableVerticalSwipes?.();
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram vertical swipe setup failed:', error);
    return false;
  }
}

export function setClosingConfirmation(enabled = true) {
  const tg = getTelegramWebApp();
  if (!tg) return false;

  try {
    if (enabled) {
      tg.enableClosingConfirmation?.();
    } else {
      tg.disableClosingConfirmation?.();
    }
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram closing confirmation setup failed:', error);
    return false;
  }
}

export function initTelegramApp() {
  const tg = getTelegramWebApp();
  if (!tg) {
    if (import.meta.env.DEV) console.warn('Telegram WebApp SDK not found. Running in browser mode.');
    return;
  }

  tg.ready?.();
  syncThemeVariables(tg);
  syncViewportVariables(tg);
  syncSafeAreaVariables(tg);
  bindTelegramEvents(tg);
  setVerticalSwipesEnabled(false);

  // JS-резерв для старых WebView, где CSS touch-action может не работать
  const _blockPinch = (e) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  document.addEventListener('touchmove', _blockPinch, { passive: false, capture: true });

  // Блокировка double-tap зума
  let _lastTap = 0;
  const _blockDoubleTap = (e) => {
    const now = Date.now();
    if (now - _lastTap < 300) e.preventDefault();
    _lastTap = now;
  };
  document.addEventListener('touchend', _blockDoubleTap, { passive: false });

  try {
    if (typeof tg.requestFullscreen === 'function') {
      tg.requestFullscreen();
    } else {
      tg.expand?.();
    }
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram fullscreen request failed, fallback to expand:', error);
    tg.expand?.();
  }
}

export function getInitData() {
  return getTelegramWebApp()?.initData || '';
}

export function getStartParam() {
  const telegramStartParam = getTelegramWebApp()?.initDataUnsafe?.start_param;
  if (telegramStartParam) return telegramStartParam;

  const readParam = (value) => {
    const query = String(value || '').replace(/^[?#]/, '');
    if (!query) return '';
    const params = new URLSearchParams(query);
    return params.get('tgWebAppStartParam') || params.get('startapp') || '';
  };

  return readParam(window?.location?.search) || readParam(window?.location?.hash);
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
  const haptic = tg?.HapticFeedback;
  if (!haptic) return false;

  const normalizedType = typeof type === 'string' ? type.toLowerCase() : 'light';

  try {
    if (normalizedType === 'selection') {
      if (typeof haptic.selectionChanged === 'function') {
        haptic.selectionChanged();
      } else {
        haptic.impactOccurred?.('light');
      }
      return true;
    }

    if (NOTIFICATION_TYPES.has(normalizedType)) {
      if (typeof haptic.notificationOccurred === 'function') {
        haptic.notificationOccurred(normalizedType);
      } else {
        haptic.impactOccurred?.('medium');
      }
      return true;
    }

    const impactStyle = IMPACT_STYLES.has(normalizedType) ? normalizedType : 'light';
    haptic.impactOccurred?.(impactStyle);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Telegram haptic feedback failed:', error);
    return false;
  }
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

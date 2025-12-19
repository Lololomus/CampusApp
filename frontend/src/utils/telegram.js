// Telegram Mini App SDK helpers

export const tg = window.Telegram?.WebApp;

export function initTelegramApp() {
  if (!tg) {
    console.warn('⚠️ Telegram WebApp SDK not found. Running in browser mode.');
    return;
  }
  
  tg.ready();
  tg.expand();
  
  // Применяем тему Telegram
  const root = document.documentElement;
  root.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#1a1a1a');
  root.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#ffffff');
  
  console.log('✅ Telegram Mini App initialized');
  console.log('Platform:', tg.platform);
}

export function getInitData() {
  return tg?.initData || '';
}

export function getTelegramUser() {
  if (!tg?.initDataUnsafe?.user) return null;
  
  const user = tg.initDataUnsafe.user;
  return {
    id: user.id,
    firstName: user.first_name,
    username: user.username,
  };
}

export function hapticFeedback(type = 'light') {
  if (!tg?.HapticFeedback) return;
  tg.HapticFeedback.impactOccurred(type);
}

export function showBackButton(onClick) {
  if (!tg?.BackButton) return;
  
  tg.BackButton.show();
  tg.BackButton.onClick(onClick);
}

export function hideBackButton() {
  if (!tg?.BackButton) return;
  tg.BackButton.hide();
}
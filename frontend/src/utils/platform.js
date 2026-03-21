// ===== FILE: frontend/src/utils/platform.js =====
import { getTelegramWebApp } from './telegram';

export const isIOS = () => {
  try {
    const platform = getTelegramWebApp()?.platform;
    if (platform) return platform === 'ios';
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  } catch {
    return false;
  }
};

export const isAndroid = () => {
  try {
    const platform = getTelegramWebApp()?.platform;
    if (platform) return platform === 'android';
    return /Android/.test(navigator.userAgent);
  } catch {
    return false;
  }
};

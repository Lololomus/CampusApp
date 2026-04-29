import { normalizeTelegramUsername } from './telegramUsername';

export const CAMPUS_MATCH_MESSAGE = 'Привет, я из Campus. У нас мэтч в Dating.\n\nДавай познакомимся?';

export function buildTelegramChatUrl(username, message = '') {
  const cleanUsername = normalizeTelegramUsername(username);
  if (!cleanUsername) return '';

  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://t.me/${cleanUsername}${query}`;
}

export function openTelegramChat(username, message = '') {
  const url = buildTelegramChatUrl(username, message);
  if (!url) return false;

  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
  return true;
}

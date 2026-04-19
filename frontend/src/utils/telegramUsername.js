const TELEGRAM_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;
const EMPTY_OPTIONAL_VALUES = new Set(['none', 'null', 'undefined']);

export function normalizeTelegramUsername(value) {
  const username = String(value ?? '').replace(/^@+/, '').trim();
  if (!username || EMPTY_OPTIONAL_VALUES.has(username.toLowerCase())) return '';
  return TELEGRAM_USERNAME_RE.test(username) ? username : '';
}

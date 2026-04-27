// ===== FILE: safeUrl.js =====
// Валидация внешних URL (CTA рекламы и т.п.).
// Блокирует javascript:, data:, file:, intent: и прочие XSS-векторы.

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'tg:']);
const TME_HOST_RE = /^(www\.)?t\.me$/i;

export function isSafeCtaUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) return false;
  return true;
}

export function isTelegramDeepLink(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('tg:')) return true;
  try {
    const parsed = new URL(trimmed);
    return TME_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

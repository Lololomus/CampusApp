import theme from '../theme';

export const AVATAR_FALLBACK_COLORS = [
  '#8774e1', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16',
  '#ef4444', '#14b8a6', '#f97316', '#0ea5e9',
  '#22c55e', '#eab308', '#6366f1', '#a855f7',
];

export function getAvatarColor(seed) {
  const source = String(seed || '').trim();
  if (!source) return theme.colors.primary;

  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }

  return AVATAR_FALLBACK_COLORS[Math.abs(hash) % AVATAR_FALLBACK_COLORS.length];
}

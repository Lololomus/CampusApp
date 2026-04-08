import { MARKET_CATEGORIES_MAP } from '../constants/marketConstants';
import { REWARD_TYPE_ICONS, REWARD_TYPES } from '../types';
import { buildMiniAppStartappUrl } from './deepLinks';
import { stripLeadingTitleFromBody } from './contentTextParser';
import { getTelegramWebApp } from './telegram';

const POST_CATEGORY_ICONS = {
  news: '📰',
  memes: '😂',
  events: '🎉',
  confessions: '💭',
  lost_found: '🔎',
};

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength = 120) {
  const normalized = compactText(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `${new Intl.NumberFormat('ru-RU').format(numeric)} ₽`;
}

function buildTelegramShareUrl(message, link) {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message)}`;
}

function openTelegramShareUrl(shareUrl) {
  const telegram = getTelegramWebApp();
  if (telegram?.openTelegramLink) {
    telegram.openTelegramLink(shareUrl);
    return;
  }

  const popup = window.open(shareUrl, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.href = shareUrl;
  }
}

function sharePayloadToTelegram(payload) {
  const shareUrl = buildTelegramShareUrl(payload.message, payload.link);
  openTelegramShareUrl(shareUrl);
  return payload;
}

function buildPostSharePayload(post) {
  const title = compactText(post?.title);
  const previewBody = compactText(stripLeadingTitleFromBody(title, post?.body));
  const categoryIcon = POST_CATEGORY_ICONS[post?.category] || '📝';
  const preview = truncateText(title || previewBody || 'Открыть пост в CampusApp', 110);
  const location = compactText(
    post?.event_location || post?.location || post?.author?.university || post?.university
  );

  const secondLine = [location, 'CampusApp'].filter(Boolean).join(' · ');

  return {
    link: buildMiniAppStartappUrl(`post_${post.id}`),
    message: `${categoryIcon} ${preview}\n${secondLine}`,
  };
}

function buildRequestRewardPart(request) {
  if (!request?.reward_type || request.reward_type === REWARD_TYPES.NONE) return null;
  const icon = REWARD_TYPE_ICONS[request.reward_type] || '🎁';
  const value = compactText(request.reward_value);
  return value ? `${icon} ${value}` : icon;
}

function buildRequestSharePayload(request) {
  const title = compactText(request?.title);
  const previewBody = compactText(stripLeadingTitleFromBody(title, request?.body));
  const preview = truncateText(title || previewBody || 'Открыть запрос в CampusApp', 110);
  const location = compactText(
    request?.author?.university || request?.university || request?.location
  );
  const reward = buildRequestRewardPart(request);

  const secondLine = [location, reward, 'CampusApp'].filter(Boolean).join(' · ');

  return {
    link: buildMiniAppStartappUrl(`request_${request.id}`),
    message: `🙋 ${preview}\n${secondLine}`,
  };
}

function buildMarketItemSharePayload(item) {
  const categoryMeta = MARKET_CATEGORIES_MAP[item?.category] || {};
  const isService = item?.item_type === 'service';
  const categoryIcon = categoryMeta.icon || (isService ? '✨' : '📦');
  const title = truncateText(item?.title || 'Открыть объявление в CampusApp', 110);
  const price = formatMoney(item?.price) || 'цена договорная';
  const location = compactText(
    item?.location || item?.seller?.university || item?.university
  );

  const firstLine = `${categoryIcon} ${title} · ${price}`;
  const secondLine = [location, 'CampusApp'].filter(Boolean).join(' · ');

  return {
    link: buildMiniAppStartappUrl(`market_${item.id}`),
    message: `${firstLine}\n${secondLine}`,
  };
}

export function sharePostViaTelegram(post) {
  return sharePayloadToTelegram(buildPostSharePayload(post));
}

export function shareRequestViaTelegram(request) {
  return sharePayloadToTelegram(buildRequestSharePayload(request));
}

export function shareMarketItemViaTelegram(item) {
  return sharePayloadToTelegram(buildMarketItemSharePayload(item));
}

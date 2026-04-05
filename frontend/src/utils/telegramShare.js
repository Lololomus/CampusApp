import { POST_CATEGORY_LABELS, REQUEST_CATEGORY_LABELS } from '../constants/contentConstants';
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

const REQUEST_CATEGORY_ICONS = {
  study: '📚',
  help: '🤝',
  hangout: '🎉',
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

function joinMessageLines(lines) {
  return lines.filter(Boolean).join('\n\n');
}

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `${new Intl.NumberFormat('ru-RU').format(numeric)} ₽`;
}

function getPostLocationLine(post) {
  const location = compactText(
    post?.event_location
      || post?.location
      || post?.author?.university
      || post?.university
  );
  return location ? `📍 ${location}` : null;
}

function getRequestLocationLine(request) {
  const location = compactText(
    request?.author?.university
      || request?.university
      || request?.location
  );
  return location ? `📍 ${location}` : null;
}

function getMarketLocationLine(item) {
  const location = compactText(
    item?.location
      || item?.seller?.university
      || item?.university
  );
  return location ? `📍 ${location}` : null;
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
  const category = post?.category;
  const categoryLabel = POST_CATEGORY_LABELS[category] || 'Пост';
  const categoryIcon = POST_CATEGORY_ICONS[category] || '📝';
  const preview = truncateText(title || previewBody || 'Открыть пост в CampusApp', 110);

  return {
    link: buildMiniAppStartappUrl(`post_${post.id}`),
    message: joinMessageLines([
      '🎓 CampusApp',
      `${categoryIcon} ${categoryLabel}`,
      preview,
      getPostLocationLine(post),
      'Открыть в CampusApp 👇',
    ]),
  };
}

function buildRequestRewardLine(request) {
  if (!request?.reward_type || request.reward_type === REWARD_TYPES.NONE) return null;

  const rewardIcon = REWARD_TYPE_ICONS[request.reward_type] || '🎁';
  const rewardValue = compactText(request.reward_value);

  return rewardValue
    ? `${rewardIcon} Вознаграждение: ${rewardValue}`
    : `${rewardIcon} Вознаграждение`;
}

function buildRequestSharePayload(request) {
  const title = compactText(request?.title);
  const previewBody = compactText(stripLeadingTitleFromBody(title, request?.body));
  const category = request?.category;
  const categoryLabel = REQUEST_CATEGORY_LABELS[category] || 'Запрос';
  const categoryIcon = REQUEST_CATEGORY_ICONS[category] || '🤝';
  const preview = truncateText(title || previewBody || 'Открыть запрос в CampusApp', 110);

  return {
    link: buildMiniAppStartappUrl(`request_${request.id}`),
    message: joinMessageLines([
      '🎓 CampusApp',
      `${categoryIcon} ${categoryLabel}`,
      preview,
      buildRequestRewardLine(request),
      getRequestLocationLine(request),
      'Открыть в CampusApp 👇',
    ]),
  };
}

function buildMarketItemSharePayload(item) {
  const categoryMeta = MARKET_CATEGORIES_MAP[item?.category] || {};
  const isService = item?.item_type === 'service';
  const headline = categoryMeta.label
    ? `${categoryMeta.icon || (isService ? '✨' : '📦')} ${categoryMeta.label}`
    : isService
      ? '🛠 Услуга'
      : '🛍 Товар';
  const priceLine = formatMoney(item?.price);
  const preview = truncateText(item?.title || 'Открыть объявление в CampusApp', 110);

  return {
    link: buildMiniAppStartappUrl(`market_${item.id}`),
    message: joinMessageLines([
      '🎓 CampusApp',
      headline,
      preview,
      priceLine ? `💸 ${priceLine}` : isService ? '💬 Цена обсуждается' : '💬 Цена по договорённости',
      getMarketLocationLine(item),
      'Открыть в CampusApp 👇',
    ]),
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

import { getUserPublic } from '../api';
import { toast } from '../components/shared/Toast';

const FALLBACK_MINIAPP_URL = 'https://t.me/MyCampusBot/app';

const EXACT_ACTIONS = Object.freeze({
  tab_feed: { action: 'tab_feed' },
  tab_feed_requests: { action: 'tab_feed_requests' },
  tab_market: { action: 'tab_market' },
  tab_dating: { action: 'tab_dating' },
  tab_profile: { action: 'tab_profile' },
  tab_notifications: { action: 'tab_notifications' },
  create_post: { action: 'create_post' },
  create_request: { action: 'create_request' },
  create_market: { action: 'create_market' },
  dating_setup: { action: 'dating_setup' },
  dating_likes: { action: 'dating_likes' },
  dating_matches: { action: 'dating_matches' },
  mod_reports: { action: 'mod_reports' },
  admin_panel: { action: 'admin_panel' },
});

const PREFIX_ACTIONS = Object.freeze([
  ['post_', 'open_post'],
  ['market_', 'open_market_item'],
  ['request_', 'open_request'],
  ['user_', 'open_user_profile'],
]);

const AUTH_REQUIRED_ACTIONS = new Set([
  'tab_dating',
  'tab_profile',
  'tab_notifications',
  'create_post',
  'create_request',
  'create_market',
  'dating_setup',
  'dating_likes',
  'dating_matches',
  'mod_reports',
  'admin_panel',
]);

const MODERATION_ACTIONS = new Set(['mod_reports', 'admin_panel']);

function getMiniAppBaseUrl() {
  const raw = String(import.meta.env.VITE_TELEGRAM_MINIAPP_URL || '').trim();
  return (raw || FALLBACK_MINIAPP_URL).replace(/\/+$/, '');
}

function requireRegisteredUser(state) {
  if (state.isRegistered) return true;
  state.setShowAuthModal(true);
  return false;
}

function resetOverlayState(state) {
  state.setShowNotificationsScreen?.(false);
  state.clearPublicProfilePreview?.();
}

function resetContentState(state) {
  state.setViewPostId?.(null);
  state.setCurrentRequest?.(null);
  state.clearPendingRequestId?.();
  state.clearPendingMarketItemId?.();
  state.clearPendingDatingTab?.();
}

export function parseDeepLink(startParam) {
  const normalized = String(startParam || '').trim();
  if (!normalized) return null;

  const exactMatch = EXACT_ACTIONS[normalized];
  if (exactMatch) {
    return { ...exactMatch, raw: normalized };
  }

  for (const [prefix, action] of PREFIX_ACTIONS) {
    const matched = normalized.match(new RegExp(`^${prefix}(\\d+)$`));
    if (matched) {
      return {
        action,
        id: Number(matched[1]),
        raw: normalized,
      };
    }
  }

  return null;
}

export function deepLinkNeedsModerationRole(link) {
  return Boolean(link && MODERATION_ACTIONS.has(link.action));
}

export function buildMiniAppStartappUrl(startParam) {
  const baseUrl = getMiniAppBaseUrl();
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}startapp=${encodeURIComponent(startParam)}`;
}

export async function executeDeepLink(link, store) {
  if (!link?.action || typeof store?.getState !== 'function') {
    return { status: 'ignored' };
  }

  const state = store.getState();
  const requireAuth = () => requireRegisteredUser(state);

  if (AUTH_REQUIRED_ACTIONS.has(link.action) && !requireAuth()) {
    return { status: 'deferred' };
  }

  if (MODERATION_ACTIONS.has(link.action) && state.moderationRole == null) {
    return { status: 'deferred' };
  }

  switch (link.action) {
    case 'open_post':
      resetOverlayState(state);
      state.setCurrentRequest?.(null);
      state.setActiveTab('feed');
      state.setFeedSubTab('posts');
      state.setViewPostId(link.id);
      return { status: 'completed' };

    case 'open_market_item':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('market');
      state.setPendingMarketItemId(link.id);
      return { status: 'completed' };

    case 'open_request':
      resetOverlayState(state);
      state.setViewPostId?.(null);
      state.setActiveTab('feed');
      state.setFeedSubTab('requests');
      state.setPendingRequestId(link.id);
      return { status: 'completed' };

    case 'open_user_profile':
      resetOverlayState(state);
      try {
        const user = await getUserPublic(link.id);
        state.setPublicProfilePreview(user);
      } catch (error) {
        const status = error?.response?.status;
        toast.error(status === 404 ? 'Пользователь не найден' : 'Не удалось загрузить профиль');
      }
      return { status: 'completed' };

    case 'tab_feed':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('feed');
      state.setFeedSubTab('posts');
      return { status: 'completed' };

    case 'tab_feed_requests':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('feed');
      state.setFeedSubTab('requests');
      return { status: 'completed' };

    case 'tab_market':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('market');
      return { status: 'completed' };

    case 'tab_dating':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('people');
      return { status: 'completed' };

    case 'tab_profile':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('profile');
      return { status: 'completed' };

    case 'tab_notifications':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('profile');
      state.setShowNotificationsScreen(true);
      return { status: 'completed' };

    case 'create_post':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('feed');
      state.setFeedSubTab('posts');
      state.setShowCreateModal(true);
      return { status: 'completed' };

    case 'create_request':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('feed');
      state.setFeedSubTab('requests');
      state.setShowCreateModal(true);
      return { status: 'completed' };

    case 'create_market':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('market');
      state.setShowCreateMarketItem(true);
      return { status: 'completed' };

    case 'dating_setup':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('people');
      state.setPendingDatingOnboardingOpen(true);
      return { status: 'completed' };

    case 'dating_likes':
    case 'dating_matches':
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('people');
      state.setPendingDatingTab('likes');
      return { status: 'completed' };

    case 'mod_reports':
      if (!state.canModerate()) {
        return { status: 'ignored' };
      }
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('ambassador');
      return { status: 'completed' };

    case 'admin_panel':
      if (!state.isSuperAdmin()) {
        return { status: 'ignored' };
      }
      resetOverlayState(state);
      resetContentState(state);
      state.setActiveTab('admin');
      return { status: 'completed' };

    default:
      return { status: 'ignored' };
  }
}

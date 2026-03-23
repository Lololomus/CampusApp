// ===== 📄 ФАЙЛ: frontend/src/api.js =====

import axios from 'axios';
import { getInitData } from './utils/telegram';

// В проде Nginx сам перехватит /api. Локально Vite проксирует /api.
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken = null;
let refreshPromise = null;
let registrationPromptTs = 0;
const registrationPromptByReason = new Map();
const IS_DEV = import.meta.env.DEV;
let notificationsMockModulePromise = null;

async function loadNotificationsMockModule() {
  if (!IS_DEV) return null;

  if (!notificationsMockModulePromise) {
    notificationsMockModulePromise = import('./components/notifications/notificationsMock');
  }

  return notificationsMockModulePromise;
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

function parseJwtPayload(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function getPersistedTelegramId() {
  try {
    const persistedRaw = localStorage.getItem('campus-storage');
    if (!persistedRaw) return null;
    const persisted = JSON.parse(persistedRaw);
    return persisted?.state?.user?.telegram_id || persisted?.user?.telegram_id || null;
  } catch {
    return null;
  }
}

function getTelegramId(optional = false) {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }

  const payload = parseJwtPayload(accessToken);
  if (payload?.tgid) {
    return Number(payload.tgid);
  }

  const persistedId = getPersistedTelegramId();
  if (persistedId) {
    return Number(persistedId);
  }

  if (optional) return null;
  throw new Error('Telegram user id is unavailable');
}

function shouldPromptOnGet(url = '') {
  return (
    url.startsWith('/users/me') ||
    url.startsWith('/dating/') ||
    url.startsWith('/market/my-items') ||
    url.startsWith('/market/favorites') ||
    url.startsWith('/api/requests/my-items')
  );
}

function isRegistrationRequiredError(error) {
  const status = error.response?.status;
  const detail = String(error.response?.data?.detail || '').toLowerCase();
  if (status === 404 && detail.includes('user not found')) return true;
  if (status === 403 && (detail.includes('register') || detail.includes('регистра'))) return true;
  return false;
}

const REG_PROMPT_COOLDOWNS = {
  default: 1800,
  feed_like: 1500,
  open_post: 1500,
  open_request: 1500,
  open_market_item: 1500,
  open_dating_tab: 900,
  open_profile_tab: 900,
  open_filters: 1200,
  vote_poll: 1200,
  search: 2000,
  report: 1500,
};

function getPromptCooldown(reason) {
  return REG_PROMPT_COOLDOWNS[reason] || REG_PROMPT_COOLDOWNS.default;
}

export async function triggerRegistrationPrompt(reason = 'default') {
  const now = Date.now();
  const reasonCooldown = getPromptCooldown(reason);
  const lastForReason = registrationPromptByReason.get(reason) || 0;
  if (now - registrationPromptTs < 700) return false;
  if (now - lastForReason < reasonCooldown) return false;

  registrationPromptTs = now;
  registrationPromptByReason.set(reason, now);

  try {
    const { useStore } = await import('./store');
    const state = useStore.getState();
    if (!state.isRegistered && typeof state.setShowAuthModal === 'function') {
      state.setShowAuthModal(true);
      return true;
    }
  } catch (e) {
    // no-op: fallback only
  }

  return false;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const method = (originalRequest?.method || 'get').toLowerCase();
    const isActionRequest = method !== 'get' || shouldPromptOnGet(originalRequest?.url || '');
    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');

    if (isRegistrationRequiredError(error) && isActionRequest) {
      await triggerRegistrationPrompt('default');
      throw error;
    }

    if (!isUnauthorized || originalRequest?._retry || isAuthEndpoint) {
      throw error;
    }

    originalRequest._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshToken().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      if (isActionRequest) {
        await triggerRegistrationPrompt('default');
      }
      throw refreshError;
    }
  }
);

export async function loginWithTelegram() {
  const init_data = getInitData();
  if (!init_data) {
    throw new Error('Telegram initData is missing. Open the app from Telegram bot.');
  }
  const response = await api.post('/auth/telegram/login', { init_data });
  setAccessToken(response.data.access_token);
  return response.data;
}

export async function ensureAccessToken() {
  if (hasAccessToken()) return accessToken;

  try {
    const refreshed = await refreshToken();
    return refreshed.access_token;
  } catch {
    const loginData = await loginWithTelegram();
    return loginData.access_token;
  }
}

export async function refreshToken() {
  const response = await api.post('/auth/refresh');
  setAccessToken(response.data.access_token);
  return response.data;
}

export async function logoutUser() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function authWithTelegram() {
  return loginWithTelegram();
}

export async function devLoginAs(telegramId) {
  const response = await api.post('/dev/auth/login-as', { telegram_id: telegramId });
  setAccessToken(response.data.access_token);
  return response.data;
}

export async function devResetUser(telegramId, hard = false) {
  const response = await api.post('/dev/auth/reset-user', { telegram_id: telegramId, hard });
  return response.data;
}

export async function registerUser(userData) {
  try {
    await ensureAccessToken();
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Ошибка регистрации:', error);
      console.error('Ответ сервера:', error.response?.data);
    }
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const response = await api.get('/users/me');
    return response.data;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    throw error;
  }
}

export async function updateUserProfile(updates) {
  try {
    const response = await api.patch('/users/me', updates);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    throw error;
  }
}

export async function getUserPosts(userId, limit = 5, offset = 0) {
  try {
    const response = await api.get(`/users/${userId}/posts`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка загрузки постов пользователя:', error);
    throw error;
  }
}

export async function getUserStats(userId) {
  try {
    const response = await api.get(`/users/${userId}/stats`);
    return response.data;
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    throw error;
  }
}

export async function getPosts(filters = {}) {
  try {
    const params = {
      skip: Number.isFinite(filters.skip) ? filters.skip : 0,
      limit: Number.isFinite(filters.limit) ? filters.limit : 20,
    };

    if (filters.category && filters.category !== 'all') {
      params.category = filters.category;
    }
    if (filters.university && filters.university !== 'all') {
      params.university = filters.university;
    }
    if (filters.institute && filters.institute !== 'all') {
      params.institute = filters.institute;
    }
    if (filters.campus_id) {
      params.campus_id = filters.campus_id;
    }
    if (filters.city) {
      params.city = filters.city;
    }
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      params.tags = filters.tags.join(',');
    }
    if (filters.dateRange && filters.dateRange !== 'all') {
      params.date_range = filters.dateRange;
    }
    if (filters.sort && filters.sort !== 'newest') {
      params.sort = filters.sort;
    }

    const response = await api.get('/posts/feed', { params });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    return { items: [], total: 0, has_more: false };
  }
}

export async function getPost(id) {
  try {
    const response = await api.get(`/posts/${id}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка получения поста:', error);
    throw error;
  }
}

export async function createPost(postData, onProgress = null) {
  try {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };

    if (onProgress) {
      config.onUploadProgress = onProgress;
    }

    const response = await api.post('/posts/create', postData, config);
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Ошибка создания поста:', error);
      console.error('Response:', error.response?.data);
    }
    throw error;
  }
}


export async function updatePost(postId, postData, onProgress = null) {
  try {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    
    if (onProgress) {
      config.onUploadProgress = onProgress;
    }
    
    const response = await api.patch(`/posts/${postId}`, postData, config);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления поста:', error);
    throw error;
  }
}

export async function deletePost(postId) {
  try {
    const response = await api.delete(`/posts/${postId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления поста:', error);
    throw error;
  }
}

export async function likePost(postId) {
  try {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  } catch (error) {
    console.error('Ошибка лайка поста:', error);
    throw error;
  }
}

// ✅ НОВАЯ ФУНКЦИЯ ДЛЯ ОПРОСОВ
export async function votePoll(pollId, optionIndices) {
  try {
    const response = await api.post(`/polls/${pollId}/vote`, {
      option_indices: optionIndices
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка голосования:', error);
    throw error;
  }
}

export async function getPostComments(postId) {
  try {
    const response = await api.get(`/posts/${postId}/comments`);
    return response.data.items || [];
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    return [];
  }
}

export async function createComment(postId, bodyOrPayload, parentId = null) {
  try {
    let body = '';
    let actualParentId = parentId;
    let isAnonymous = false;
    let images = [];

    if (typeof bodyOrPayload === 'object' && bodyOrPayload !== null && !Array.isArray(bodyOrPayload)) {
      body = String(bodyOrPayload.body ?? '');
      actualParentId = bodyOrPayload.parentId ?? null;
      isAnonymous = Boolean(bodyOrPayload.isAnonymous);
      images = Array.isArray(bodyOrPayload.images) ? bodyOrPayload.images.filter(Boolean) : [];
    } else {
      body = String(bodyOrPayload ?? '');
    }

    const text = body.trim();
    if (!text && images.length === 0) {
      throw new Error('Комментарий должен содержать текст или фото');
    }
    if (images.length > 3) {
      throw new Error('Максимум 3 изображения');
    }

    if (images.length > 0) {
      const formData = new FormData();
      formData.append('body', text);
      if (actualParentId !== null && actualParentId !== undefined) {
        formData.append('parent_id', String(actualParentId));
      }
      formData.append('is_anonymous', isAnonymous ? 'true' : 'false');
      images.forEach((file) => formData.append('images', file));

      const response = await api.post(`/posts/${postId}/comments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }

    const payload = {
      post_id: postId,
      body: text,
      is_anonymous: isAnonymous,
      parent_id: actualParentId
    };

    const response = await api.post(`/posts/${postId}/comments`, payload);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    throw error;
  }
}

export async function likeComment(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/like`);
    return response.data;
  } catch (error) {
    console.error('Ошибка лайка комментария:', error);
    throw error;
  }
}

export async function deleteComment(commentId) {
  try {
    const response = await api.delete(`/comments/${commentId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    throw error;
  }
}

export async function updateComment(commentId, text) {
  try {
    const response = await api.patch(
      `comments/${commentId}`,
      { body: text },
    );
    return response.data;
  } catch (error) {
    console.error('Ошибка редактирования:', error);
    throw error;
  }
}

export async function reportComment(commentId, reason, description = null) {
  // Deprecated: оставляем для обратной совместимости старых вызовов UI.
  return createReport('comment', commentId, reason, description);
}

export async function createRequest(requestData, onProgress = null) {
  try {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };
    if (onProgress) {
      config.onUploadProgress = onProgress;
    }

    const response = await api.post('/api/requests/create', requestData, config);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания запроса:', error);
    throw error;
  }
}

export async function getRequestsFeed(filters = {}) {
  try {
    const params = {
      limit: filters.limit || 20,
      offset: filters.offset || 0
    };

    if (filters.category && filters.category !== 'all') {
      params.category = filters.category;
    }
    if (filters.university && filters.university !== 'all') {
      params.university = filters.university;
    }
    if (filters.institute && filters.institute !== 'all') {
      params.institute = filters.institute;
    }
    if (filters.campus_id) {
      params.campus_id = filters.campus_id;
    }
    if (filters.city) {
      params.city = filters.city;
    }
    if (filters.status && filters.status !== 'active') {
      params.status = filters.status;
    }
    if (filters.hasReward && filters.hasReward !== 'all') {
      params.has_reward = filters.hasReward;
    }
    if (filters.urgency && filters.urgency !== 'all') {
      params.urgency = filters.urgency;
    }
    if (filters.sort && filters.sort !== 'newest') {
      params.sort = filters.sort;
    }
    
    const response = await api.get('/api/requests/feed', { params });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения запросов:', error);
    return { items: [], total: 0, has_more: false };
  }
}

export async function getRequestById(requestId) {
  try {
    const response = await api.get(`/api/requests/${requestId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка получения запроса:', error);
    throw error;
  }
}

export async function updateRequest(requestId, data) {
  try {
    const response = await api.put(`/api/requests/${requestId}`, data);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления запроса:', error);
    throw error;
  }
}

export async function deleteRequest(requestId) {
  try {
    const response = await api.delete(`/api/requests/${requestId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления запроса:', error);
    throw error;
  }
}

export async function getMyRequests(limit = 20, offset = 0) {
  try {
    const response = await api.get(`/api/requests/my-items`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Get my requests error:', error);
    return [];
  }
}

export async function respondToRequest(requestId, message = null, telegram_contact = null) {
  try {
    const response = await api.post(`/api/requests/${requestId}/respond`, {
      message: message,
      telegram_contact: telegram_contact
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка отклика на запрос:', error);
    throw error;
  }
}

export async function getRequestResponses(requestId) {
  try {
    const response = await api.get(`/api/requests/${requestId}/responses`);
    return response.data;
  } catch (error) {
    console.error('Ошибка получения откликов:', error);
    throw error;
  }
}

export async function deleteResponse(responseId) {
  try {
    const response = await api.delete(`/api/responses/${responseId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления отклика:', error);
    throw error;
  }
}

export async function getMarketItems(filters = {}) {
  try {
    const skip = filters.skip || 0;
    const limit = filters.limit || 20;

    if (filters.favorites_only) {
      const response = await api.get('/market/favorites', {
        params: { limit, offset: skip }
      });
      const items = response.data || [];
      return {
        items,
        total: items.length,
        has_more: items.length === limit
      };
    }

    if (filters.seller_id) {
      const response = await api.get('/market/my-items', {
        params: { limit, offset: skip }
      });
      const items = response.data || [];
      return {
        items,
        total: items.length,
        has_more: items.length === limit
      };
    }

    const params = { skip, limit };
    
    if (filters.item_type) params.item_type = filters.item_type;
    if (filters.category && filters.category !== 'all') params.category = filters.category;
    if (filters.price_min) params.price_min = filters.price_min;
    if (filters.price_max) params.price_max = filters.price_max;
    if (filters.condition) params.condition = filters.condition;
    if (filters.university && filters.university !== 'all') params.university = filters.university;
    if (filters.institute && filters.institute !== 'all') params.institute = filters.institute;
    if (filters.campus_id) params.campus_id = filters.campus_id;
    if (filters.city) params.city = filters.city;
    if (filters.sort) params.sort = filters.sort;
    if (filters.search) params.search = filters.search;
    
    const response = await api.get('/market/feed', { params });
    return response.data;

  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    return { items: [], total: 0, has_more: false };
  }
}

export async function getMarketItem(itemId) {
  try {
    const response = await api.get(`/market/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка получения товара:', error);
    throw error;
  }
}

export async function contactMarketSeller(itemId) {
  await api.post(`/market/${itemId}/contact`);
}

export async function createMarketItem(itemData, onProgress = null) {
  try {
    const config = {
      headers: { 'Content-Type': 'multipart/form-data' }
    };

    if (onProgress) config.onUploadProgress = onProgress;

    const response = await api.post('/market/items', itemData, config);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания товара:', error);
    throw error;
  }
}

export async function updateMarketItem(itemId, itemData, onProgress = null) {
  try {
    const config = {
      headers: { 'Content-Type': 'multipart/form-data' }
    };

    if (onProgress) config.onUploadProgress = onProgress;

    const response = await api.patch(`/market/${itemId}`, itemData, config);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления товара:', error);
    throw error;
  }
}

export async function deleteMarketItem(itemId) {
  try {
    const response = await api.delete(`/market/${itemId}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    throw error;
  }
}

export async function toggleMarketFavorite(itemId) {
  try {
    const response = await api.post(`/market/${itemId}/favorite`);
    return response.data;
  } catch (error) {
    console.error('Ошибка toggle избранного:', error);
    throw error;
  }
}

export async function getMarketFavorites(limit = 20, offset = 0) {
  try {
    const response = await api.get('/market/favorites', {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения избранных:', error);
    return [];
  }
}

export async function getMyMarketItems(limit = 20, offset = 0) {
  try {
    const response = await api.get(`/market/my-items`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) console.error('Get my market items error:', error);
    throw error;
  }
}


export async function getMarketCategories() {
  try {
    const response = await api.get('/market/categories');
    return response.data;
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    return { standard: [], popular_custom: [] };
  }
}

export async function createMarketReview({ deal_id, item_id, rating, text }) {
  const payload = { rating, text, source: 'app' };
  if (deal_id) payload.deal_id = deal_id;
  if (!deal_id && item_id) payload.item_id = item_id;
  const response = await api.post('/market/reviews', payload);
  return response.data;
}

export async function getSellerRating(userId) {
  try {
    const response = await api.get(`/users/${userId}/rating`);
    return response.data;
  } catch {
    return { avg: null, count: 0, product: { avg: null, count: 0 }, service: { avg: null, count: 0 } };
  }
}

export async function skipReviewRequest({ itemId = null, dealId = null } = {}) {
  const telegram_id = getTelegramId();
  const params = { telegram_id };
  if (dealId) params.deal_id = dealId;
  if (!dealId && itemId) params.item_id = itemId;
  await api.post('/market/reviews/skip', null, { params });
}

export async function getMyDatingProfile() {
  try {
    const response = await api.get('/dating/profile/me');
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

export async function createDatingProfile(data) {
  const formData = new FormData();

  formData.append('gender', data.gender);
  formData.append('looking_for', data.looking_for);
  formData.append('age', data.age);
  
  if (data.bio) {
    formData.append('bio', data.bio);
  }

  if (data.goals) {
    formData.append('goals', JSON.stringify(data.goals));
  }

  if (data.interests) {
    formData.append('interests', JSON.stringify(data.interests));
  }

  if (data.prompt_question && data.prompt_answer) {
    formData.append('prompt_question', data.prompt_question);
    formData.append('prompt_answer', data.prompt_answer);
  }

  if (data.photos && data.photos.length > 0) {
    data.photos.forEach(file => {
      formData.append('photos', file);
    });
  }

  const response = await api.post('/dating/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function updateDatingProfile(formData) {
  try {
    const response = await api.post('/dating/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления dating профиля:', error);
    throw error;
  }
}

export async function getDatingFeed(limit = 10, offset = 0) {
  const response = await api.get('/dating/feed', {
    params: { limit, offset }
  });
  return response.data;
}

export async function likeUser(targetUserId) {
  const response = await api.post(`/dating/${targetUserId}/like`);
  return response.data;
}

export async function dislikeUser(targetUserId) {
  const response = await api.post(`/dating/${targetUserId}/dislike`);
  return response.data;
}

export async function getDatingStats() {
  const response = await api.get('/dating/stats');
  return response.data;
}

export async function getWhoLikedMe(limit = 20, offset = 0) {
  const response = await api.get('/dating/likes-received', {
    params: { limit, offset }
  });
  return response.data;
}

export async function getMyMatches() {
  try {
    const response = await api.get('/dating/matches-active');
    
    return response.data;
  } catch (error) {
    if (import.meta.env.DEV) console.error('getMyMatches error:', error);
    throw error;
  }
}

export async function updateDatingSettings(settings) {
  try {
    const response = await api.patch('/dating/settings', settings);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления настроек dating:', error);
    throw error;
  }
}

export async function uploadUserAvatar(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/users/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}


// ========================================
// МОДЕРАЦИЯ
// ========================================

/** Получить свою роль и возможности */
export async function getMyModerationRole() {
  try {
    const response = await api.get('/moderation/my-role');
    return response.data;
  } catch (error) {
    console.error('Ошибка получения роли:', error);
    return { role: 'user', can_moderate: false, can_admin: false };
  }
}

/** Удалить пост (модерация) */
export async function moderateDeletePost(postId, reason) {
  const response = await api.delete(`/moderation/posts/${postId}`, {
    data: { reason }
  });
  return response.data;
}

/** Удалить комментарий (модерация) */
export async function moderateDeleteComment(commentId, reason) {
  const response = await api.delete(`/moderation/comments/${commentId}`, {
    data: { reason }
  });
  return response.data;
}

/** Удалить запрос (модерация) */
export async function moderateDeleteRequest(requestId, reason) {
  const response = await api.delete(`/moderation/requests/${requestId}`, {
    data: { reason }
  });
  return response.data;
}

/** Удалить товар (модерация) */
export async function moderateDeleteMarketItem(itemId, reason) {
  const response = await api.delete(`/moderation/market/${itemId}`, {
    data: { reason }
  });
  return response.data;
}

/** Закрепить/открепить пост */
export async function togglePinPost(postId, reason = null) {
  const response = await api.post(`/moderation/posts/${postId}/pin`,
    { reason }
  );
  return response.data;
}

/** Теневой бан */
export async function shadowBanUser(data) {
  const response = await api.post('/moderation/ban', data);
  return response.data;
}

/** Снять теневой бан */
export async function shadowUnbanUser(userId) {
  const response = await api.delete(`/moderation/ban/${userId}`);
  return response.data;
}


// ========================================
// ЖАЛОБЫ (REPORTS)
// ========================================

/** Отправить жалобу (любой пользователь) */
export async function createReport(targetType, targetId, reason, description = null, meta = null) {
  const payload = {
    target_type: targetType,
    target_id: targetId,
    reason,
    description
  };

  if (meta?.sourceType && meta?.sourceId) {
    payload.source_type = meta.sourceType;
    payload.source_id = meta.sourceId;
  }

  const response = await api.post('/reports', payload);
  return response.data;
}

/** Получить список жалоб (модератор) */
export async function getReports(status = 'pending', targetType = null, limit = 20, offset = 0) {
  const params = { status, limit, offset };
  if (targetType) params.target_type = targetType;
  const response = await api.get('/reports', { params });
  return response.data;
}

/** Обработать жалобу (модератор) */
export async function reviewReport(reportId, status, moderatorNote = null) {
  const params = { status };
  if (moderatorNote) params.moderator_note = moderatorNote;
  const response = await api.patch(`/reports/${reportId}`, null, { params });
  return response.data;
}


// ========================================
// ОБЖАЛОВАНИЯ (APPEALS)
// ========================================

/** Создать обжалование */
export async function createAppeal(moderationLogId, message) {
  const response = await api.post('/appeals', {
    moderation_log_id: moderationLogId,
    message
  });
  return response.data;
}

/** Получить список обжалований (суперадмин) */
export async function getAppeals(status = 'pending', limit = 20, offset = 0) {
  const response = await api.get('/appeals', {
    params: { status, limit, offset }
  });
  return response.data;
}

/** Рассмотреть обжалование (суперадмин) */
export async function reviewAppeal(appealId, status, reviewerNote = null) {
  const params = { status };
  if (reviewerNote) params.reviewer_note = reviewerNote;
  const response = await api.patch(`/appeals/${appealId}`, null, { params });
  return response.data;
}


// ========================================
// АДМИНКА
// ========================================

/** Список амбассадоров */
export async function getAmbassadors() {
  const response = await api.get('/admin/ambassadors');
  return response.data;
}

/** Назначить амбассадора */
export async function assignAmbassador(targetTelegramId, university = null) {
  const response = await api.post('/admin/ambassadors', {
    telegram_id: targetTelegramId,
    university
  });
  return response.data;
}

/** Снять амбассадора */
export async function removeAmbassador(userId) {
  const response = await api.delete(`/admin/ambassadors/${userId}`);
  return response.data;
}

/** Логи модерации */
export async function getModerationLogs(filters = {}) {
  const params = {
    limit: filters.limit || 50,
    offset: filters.offset || 0
  };
  if (filters.moderator_id) params.moderator_id = filters.moderator_id;
  if (filters.action) params.action = filters.action;
  if (filters.university) params.university = filters.university;
  const response = await api.get('/admin/logs', { params });
  return response.data;
}

/** Статистика (суперадмин) */
export async function getAdminStats() {
  const response = await api.get('/admin/stats');
  return response.data;
}

/** Analytics: latest generated report metadata */
export async function getAnalyticsLatestReport() {
  const response = await api.get('/analytics/reports/latest');
  return response.data;
}

/** Analytics: JSON report for a specific date (YYYY-MM-DD) */
export async function getAnalyticsReport(reportDate) {
  const response = await api.get(`/analytics/reports/${reportDate}`);
  return response.data;
}

/** Analytics: rebuild daily report for a specific date (admin-only) */
export async function rebuildAnalyticsReport(reportDate) {
  const response = await api.post('/analytics/reports/rebuild', null, {
    params: { date: reportDate }
  });
  return response.data;
}

/** Analytics: ingest and quality health status */
export async function getAnalyticsHealth() {
  const response = await api.get('/analytics/health');
  return response.data;
}

/** Analytics: download JSON or CSV zip report file */
export async function downloadAnalyticsReport(reportDate, format = 'json') {
  const normalizedFormat = format === 'csv' ? 'csv' : 'json';
  const response = await api.get(`/analytics/reports/${reportDate}/download`, {
    params: { format: normalizedFormat },
    responseType: 'blob'
  });

  const ext = normalizedFormat === 'csv' ? 'zip' : 'json';
  const blob = new Blob([response.data], {
    type: response.headers?.['content-type'] || (normalizedFormat === 'csv' ? 'application/zip' : 'application/json')
  });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `campus_analytics_${reportDate}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}


// ========================================
// РЕКЛАМА (ADS)
// ========================================

/** Создать рекламный пост (multipart/form-data) */
export async function createAdPost(adData) {
  const formData = new FormData();
  formData.append('title', adData.title);
  formData.append('body', adData.body);
  formData.append('advertiser_name', adData.advertiser_name);
  formData.append('scope', adData.scope);
  formData.append('cta_text', adData.cta_text);
  formData.append('cta_url', adData.cta_url);
  formData.append('impression_limit', String(adData.impression_limit));
  formData.append('priority', String(adData.priority));
  if (adData.ends_at) formData.append('ends_at', adData.ends_at);
  if (adData.target_university) formData.append('target_university', adData.target_university);
  if (adData.target_city) formData.append('target_city', adData.target_city);
  if (adData.daily_impression_cap != null) formData.append('daily_impression_cap', String(adData.daily_impression_cap));
  if (adData.images && adData.images.length > 0) {
    adData.images.forEach((file) => formData.append('images', file));
  }
  const response = await api.post('/ads/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** Список рекламных постов (для админки) */
export async function getAdPosts(filters = {}) {
  const params = { limit: filters.limit || 20, offset: filters.offset || 0 };
  if (filters.status) params.status = filters.status;
  if (filters.scope) params.scope = filters.scope;
  const response = await api.get('/ads/list', { params });
  return response.data;
}

/** Получить рекламный пост по ID */
export async function getAdPost(adId) {
  const response = await api.get(`/ads/${adId}`);
  return response.data;
}

/** Обновить рекламный пост */
export async function updateAdPost(adId, updateData) {
  const response = await api.patch(`/ads/${adId}`, updateData);
  return response.data;
}

/** Удалить рекламный пост */
export async function deleteAdPost(adId) {
  const response = await api.delete(`/ads/${adId}`);
  return response.data;
}

/** Одобрить рекламный пост */
export async function approveAdPost(adId) {
  const response = await api.post(`/ads/${adId}/approve`);
  return response.data;
}

/** Отклонить рекламный пост */
export async function rejectAdPost(adId, rejectReason = null) {
  const response = await api.post(`/ads/${adId}/reject`, {
    reject_reason: rejectReason
  });
  return response.data;
}

/** Пауза / снять паузу */
export async function pauseAdPost(adId) {
  const response = await api.post(`/ads/${adId}/pause`);
  return response.data;
}

export async function resumeAdPost(adId) {
  const response = await api.post(`/ads/${adId}/resume`);
  return response.data;
}

/** Получить рекламные посты для подмешивания в ленту */
export async function getAdsForFeed(limit = 3) {
  try {
    const response = await api.get('/ads/feed/active', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка загрузки рекламы:', error);
    return [];
  }
}

/** Трекинг показа рекламы */
export async function trackAdImpression(adId) {
  try {
    await api.post(`/ads/${adId}/impression`);
  } catch (error) {
    // Тихо проглатываем — трекинг не должен ломать UX
    if (import.meta.env.DEV) console.warn('Ad impression tracking failed:', error);
  }
}

/** Трекинг клика по CTA */
export async function trackAdClick(adId) {
  try {
    await api.post(`/ads/${adId}/click`);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Ad click tracking failed:', error);
  }
}

/** Статистика по рекламному посту */
export async function getAdStats(adId) {
  const response = await api.get(`/ads/${adId}/stats`);
  return response.data;
}

/** Сводная статистика рекламы */
export async function getAdOverviewStats() {
  const response = await api.get('/ads/stats/overview');
  return response.data;
}

/** Скрыть рекламное объявление */
export async function hideAd(adId) {
  try {
    await api.post(`/ads/${adId}/hide`);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Ad hide failed:', error);
  }
}

/** Отменить скрытие рекламного объявления */
export async function unhideAd(adId) {
  try {
    await api.delete(`/ads/${adId}/hide`);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Ad unhide failed:', error);
  }
}


// ========================================
// УВЕДОМЛЕНИЯ (NOTIFICATIONS)
// ========================================

/** Получить настройки уведомлений */
export async function getNotificationSettings() {
  try {
    const response = await api.get('/notifications/settings');
    return response.data;
  } catch (error) {
    console.error('Ошибка получения настроек уведомлений:', error);
    return {
      matches_enabled: true,
      dating_likes_enabled: true,
      comments_enabled: true,
      market_enabled: true,
      requests_enabled: true,
      milestones_enabled: true,
      digest_enabled: false,
      digest_frequency: 'weekly',
      mute_all: false,
    };
  }
}

/** Обновить настройки уведомлений */
export async function updateNotificationSettings(settings) {
  try {
    const response = await api.patch('/notifications/settings', settings);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления настроек уведомлений:', error);
    throw error;
  }
}

/** Получить уведомления из inbox */
export async function getNotifications() {
  if (IS_DEV) {
    try {
      const { getDevMockNotifications } = await loadNotificationsMockModule();
      return getDevMockNotifications();
    } catch (error) {
      console.warn('Notifications mock load failed, falling back to API:', error);
    }
  }

  const response = await api.get('/notifications/inbox');
  return response.data;
}

/** Получить количество непрочитанных уведомлений */
export async function getUnreadNotificationsCount() {
  if (IS_DEV) {
    try {
      const { getDevMockUnreadNotificationsCount } = await loadNotificationsMockModule();
      return getDevMockUnreadNotificationsCount();
    } catch (error) {
      console.warn('Notifications mock load failed, falling back to API:', error);
    }
  }

  const response = await api.get('/notifications/inbox/unread-count');
  return response.data;
}

/** Отметить все уведомления как прочитанные */
export async function markAllNotificationsRead() {
  if (IS_DEV) {
    try {
      const { markAllDevMockNotificationsRead } = await loadNotificationsMockModule();
      return markAllDevMockNotificationsRead();
    } catch (error) {
      console.warn('Notifications mock load failed, falling back to API:', error);
    }
  }

  const response = await api.post('/notifications/inbox/read-all');
  return response.data;
}


// ===== CAMPUS MANAGEMENT =====

export async function getUnboundUsers(search = '', limit = 100, offset = 0) {
  try {
    const params = { limit, offset };
    if (search) params.search = search;
    const response = await api.get('/admin/campuses/unbound-users', { params });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения непривязанных:', error);
    return { items: [], total: 0, has_more: false };
  }
}

export async function bindUserToCampus(userId, campusId, university, city = null) {
  try {
    const response = await api.post('/admin/campuses/bind-user', {
      user_id: userId,
      campus_id: campusId,
      university: university,
      city: city,
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка привязки к кампусу:', error);
    throw error;
  }
}

export async function unbindUserFromCampus(userId) {
  try {
    const response = await api.post('/admin/campuses/unbind-user', {
      user_id: userId,
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка отвязки от кампуса:', error);
    throw error;
  }
}


export { api };

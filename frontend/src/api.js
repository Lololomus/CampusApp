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

async function openRegistrationPrompt() {
  const now = Date.now();
  if (now - registrationPromptTs < 1200) return;
  registrationPromptTs = now;

  try {
    const { useStore } = await import('./store');
    const state = useStore.getState();
    if (!state.isRegistered && typeof state.setShowAuthModal === 'function') {
      state.setShowAuthModal(true);
    }
  } catch (e) {
    // no-op: fallback only
  }
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
      await openRegistrationPrompt();
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
        await openRegistrationPrompt();
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
    if (!hasAccessToken()) {
      await loginWithTelegram();
    }
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    console.error('Ответ сервера:', error.response?.data);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const telegram_id = getTelegramId(true);
    const response = await api.get('/users/me', { params: telegram_id ? { telegram_id } : {} });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    throw error;
  }
}

export async function updateUserProfile(updates) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.patch('/users/me', updates, {
      params: { telegram_id },
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления профиля:', error);
    throw error;
  }
}

export async function getUserPosts(userId, limit = 5, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/users/${userId}/posts`, {
      params: { telegram_id, limit, offset }
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
    const telegram_id = getTelegramId();
    const params = {
      telegram_id,
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
    const telegram_id = getTelegramId();
    const response = await api.get(`/posts/${id}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения поста:', error);
    throw error;
  }
}

export async function createPost(postData, onProgress = null) {
  try {
    const telegram_id = getTelegramId();
    
    console.log('📤 FormData contents:');
    for (let [key, value] of postData.entries()) {
      console.log(`  ${key}:`, value);
    }
    
    const config = {
      params: { telegram_id },
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
    console.error('❌ Ошибка создания поста:', error);
    console.error('📍 Response:', error.response?.data);
    console.error('📍 Status:', error.response?.status);
    console.error('📍 Headers:', error.response?.headers);
    throw error;
  }
}


export async function updatePost(postId, postData, onProgress = null) {
  try {
    const telegram_id = getTelegramId();
    
    const config = {
      params: { telegram_id },
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
    const telegram_id = getTelegramId();
    const response = await api.delete(`/posts/${postId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления поста:', error);
    throw error;
  }
}

export async function likePost(postId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/posts/${postId}/like`, null, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка лайка поста:', error);
    throw error;
  }
}

// ✅ НОВАЯ ФУНКЦИЯ ДЛЯ ОПРОСОВ
export async function votePoll(pollId, optionIndices) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/polls/${pollId}/vote`, {
      option_indices: optionIndices
    }, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка голосования:', error);
    throw error;
  }
}

export async function getPostComments(postId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/posts/${postId}/comments`, {
      params: { telegram_id }
    });
    return response.data.items || [];
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    return [];
  }
}

export async function createComment(postId, body, parentId = null) {
  try {
    const telegram_id = getTelegramId();
    if (!body || body.trim().length === 0) {
      throw new Error('Тело комментария обязательно');
    }
    
    const payload = {
      post_id: postId,
      body: body.trim(),
      is_anonymous: false,
      parent_id: parentId
    };
    
    const response = await api.post(`/posts/${postId}/comments`, payload, {
      params: { telegram_id },
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    throw error;
  }
}

export async function likeComment(commentId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/comments/${commentId}/like`, null, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка лайка комментария:', error);
    throw error;
  }
}

export async function deleteComment(commentId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.delete(`/comments/${commentId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    throw error;
  }
}

export async function updateComment(commentId, text) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.patch(
      `comments/${commentId}`,
      { body: text },
      { params: { telegram_id } }
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
    const telegram_id = getTelegramId();
    
    const config = {
      params: { telegram_id },
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
    const telegram_id = getTelegramId();
    const params = { 
      limit: filters.limit || 20, 
      offset: filters.offset || 0 
    };
    
    if (telegram_id) params.telegram_id = telegram_id;
    
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
    const telegram_id = getTelegramId();
    const response = await api.get(`/api/requests/${requestId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения запроса:', error);
    throw error;
  }
}

export async function updateRequest(requestId, data) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.put(`/api/requests/${requestId}`, data, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления запроса:', error);
    throw error;
  }
}

export async function deleteRequest(requestId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.delete(`/api/requests/${requestId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления запроса:', error);
    throw error;
  }
}

export async function getMyRequests(limit = 20, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/api/requests/my-items`, {
      params: { telegram_id, limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Get my requests error:', error);
    return [];
  }
}

export async function respondToRequest(requestId, message = null, telegram_contact = null) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/api/requests/${requestId}/respond`, {
      message: message,
      telegram_contact: telegram_contact
    }, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка отклика на запрос:', error);
    throw error;
  }
}

export async function getRequestResponses(requestId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/api/requests/${requestId}/responses`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения откликов:', error);
    throw error;
  }
}

export async function deleteResponse(responseId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.delete(`/api/responses/${responseId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления отклика:', error);
    throw error;
  }
}

export async function getMarketItems(filters = {}) {
  try {
    const telegram_id = getTelegramId();
    const skip = filters.skip || 0;
    const limit = filters.limit || 20;

    if (filters.favorites_only) {
      const response = await api.get('/market/favorites', {
        params: { telegram_id, limit, offset: skip }
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
        params: { telegram_id, limit, offset: skip }
      });
      const items = response.data || [];
      return {
        items,
        total: items.length,
        has_more: items.length === limit
      };
    }

    const params = { telegram_id, skip, limit };
    
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
    const telegram_id = getTelegramId();
    const response = await api.get(`/market/${itemId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения товара:', error);
    throw error;
  }
}

export async function createMarketItem(itemData, onProgress = null) {
  try {
    const telegram_id = getTelegramId();
    
    const config = {
      params: { telegram_id },
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
    const telegram_id = getTelegramId();
    
    const config = {
      params: { telegram_id },
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
    const telegram_id = getTelegramId();
    const response = await api.delete(`/market/${itemId}`, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    throw error;
  }
}

export async function toggleMarketFavorite(itemId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/market/${itemId}/favorite`, null, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка toggle избранного:', error);
    throw error;
  }
}

export async function getMarketFavorites(limit = 20, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/market/favorites', {
      params: { telegram_id, limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения избранных:', error);
    return [];
  }
}

export async function getMyMarketItems(limit = 20, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/market/my-items`, {
      params: { telegram_id, limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Get my market items error:', error);
    console.error('📍 Response:', error.response?.data);
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

export async function getMyDatingProfile() {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/dating/profile/me', { params: { telegram_id } });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
}

export async function createDatingProfile(data) {
  const telegram_id = getTelegramId();
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
    params: { telegram_id },
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

export async function updateDatingProfile(formData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/dating/profile', formData, {
      params: { telegram_id },
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
  const telegram_id = getTelegramId();
  const response = await api.get('/dating/feed', {
    params: { telegram_id, limit, offset }
  });
  return response.data;
}

export async function likeUser(targetUserId) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/dating/${targetUserId}/like`, null, {
    params: { telegram_id }
  });
  return response.data;
}

export async function dislikeUser(targetUserId) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/dating/${targetUserId}/dislike`, null, {
    params: { telegram_id }
  });
  return response.data;
}

export async function getDatingStats() {
  const telegram_id = getTelegramId();
  const response = await api.get('/dating/stats', { params: { telegram_id } });
  return response.data;
}

export async function getWhoLikedMe(limit = 20, offset = 0) {
  const telegram_id = getTelegramId();
  const response = await api.get('/dating/likes-received', {
    params: { telegram_id, limit, offset }
  });
  return response.data;
}

export async function getMyMatches() {
  try {
    const telegram_id = getTelegramId();
    console.log('🔍 getMyMatches вызван, telegram_id:', telegram_id);
    
    const response = await api.get('/dating/matches-active', {
      params: { telegram_id }
    });
    
    console.log('✅ Matches получены:', response.data);
    console.log('📊 Количество матчей:', response.data?.length);
    
    return response.data;
  } catch (error) {
    console.error('❌ ОШИБКА getMyMatches:', error);
    console.error('📍 Response:', error.response?.data);
    console.error('📍 Status:', error.response?.status);
    
    // ⚠️ НЕ СКРЫВАЙ ОШИБКУ - пробрось её выше
    throw error; // Вместо return []
  }
}

export async function updateDatingSettings(settings) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.patch('/dating/settings', settings, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления настроек dating:', error);
    throw error;
  }
}

export async function uploadUserAvatar(file) {
  const telegram_id = getTelegramId();
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/users/me/avatar', formData, {
    params: { telegram_id },
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
    const telegram_id = getTelegramId();
    const response = await api.get('/moderation/my-role', {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения роли:', error);
    return { role: 'user', can_moderate: false, can_admin: false };
  }
}

/** Удалить пост (модерация) */
export async function moderateDeletePost(postId, reason) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/moderation/posts/${postId}`, {
    params: { telegram_id },
    data: { reason }
  });
  return response.data;
}

/** Удалить комментарий (модерация) */
export async function moderateDeleteComment(commentId, reason) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/moderation/comments/${commentId}`, {
    params: { telegram_id },
    data: { reason }
  });
  return response.data;
}

/** Удалить запрос (модерация) */
export async function moderateDeleteRequest(requestId, reason) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/moderation/requests/${requestId}`, {
    params: { telegram_id },
    data: { reason }
  });
  return response.data;
}

/** Удалить товар (модерация) */
export async function moderateDeleteMarketItem(itemId, reason) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/moderation/market/${itemId}`, {
    params: { telegram_id },
    data: { reason }
  });
  return response.data;
}

/** Закрепить/открепить пост */
export async function togglePinPost(postId, reason = null) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/moderation/posts/${postId}/pin`, 
    { reason },
    { params: { telegram_id } }
  );
  return response.data;
}

/** Теневой бан */
export async function shadowBanUser(data) {
  const telegram_id = getTelegramId();
  const response = await api.post('/moderation/ban', data, {
    params: { telegram_id }
  });
  return response.data;
}

/** Снять теневой бан */
export async function shadowUnbanUser(userId) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/moderation/ban/${userId}`, {
    params: { telegram_id }
  });
  return response.data;
}


// ========================================
// ЖАЛОБЫ (REPORTS)
// ========================================

/** Отправить жалобу (любой пользователь) */
export async function createReport(targetType, targetId, reason, description = null, meta = null) {
  const telegram_id = getTelegramId();
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

  const response = await api.post('/reports', payload, {
    params: { telegram_id }
  });
  return response.data;
}

/** Получить список жалоб (модератор) */
export async function getReports(status = 'pending', targetType = null, limit = 20, offset = 0) {
  const telegram_id = getTelegramId();
  const params = { telegram_id, status, limit, offset };
  if (targetType) params.target_type = targetType;
  const response = await api.get('/reports', { params });
  return response.data;
}

/** Обработать жалобу (модератор) */
export async function reviewReport(reportId, status, moderatorNote = null) {
  const telegram_id = getTelegramId();
  const params = { telegram_id, status };
  if (moderatorNote) params.moderator_note = moderatorNote;
  const response = await api.patch(`/reports/${reportId}`, null, { params });
  return response.data;
}


// ========================================
// ОБЖАЛОВАНИЯ (APPEALS)
// ========================================

/** Создать обжалование */
export async function createAppeal(moderationLogId, message) {
  const telegram_id = getTelegramId();
  const response = await api.post('/appeals', {
    moderation_log_id: moderationLogId,
    message
  }, {
    params: { telegram_id }
  });
  return response.data;
}

/** Получить список обжалований (суперадмин) */
export async function getAppeals(status = 'pending', limit = 20, offset = 0) {
  const telegram_id = getTelegramId();
  const response = await api.get('/appeals', {
    params: { telegram_id, status, limit, offset }
  });
  return response.data;
}

/** Рассмотреть обжалование (суперадмин) */
export async function reviewAppeal(appealId, status, reviewerNote = null) {
  const telegram_id = getTelegramId();
  const params = { telegram_id, status };
  if (reviewerNote) params.reviewer_note = reviewerNote;
  const response = await api.patch(`/appeals/${appealId}`, null, { params });
  return response.data;
}


// ========================================
// АДМИНКА
// ========================================

/** Список амбассадоров */
export async function getAmbassadors() {
  const telegram_id = getTelegramId();
  const response = await api.get('/admin/ambassadors', {
    params: { telegram_id }
  });
  return response.data;
}

/** Назначить амбассадора */
export async function assignAmbassador(targetTelegramId, university = null) {
  const telegram_id = getTelegramId();
  const response = await api.post('/admin/ambassadors', {
    telegram_id: targetTelegramId,
    university
  }, {
    params: { telegram_id }
  });
  return response.data;
}

/** Снять амбассадора */
export async function removeAmbassador(userId) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/admin/ambassadors/${userId}`, {
    params: { telegram_id }
  });
  return response.data;
}

/** Логи модерации */
export async function getModerationLogs(filters = {}) {
  const telegram_id = getTelegramId();
  const params = { 
    telegram_id,
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
  const telegram_id = getTelegramId();
  const response = await api.get('/admin/stats', {
    params: { telegram_id }
  });
  return response.data;
}


// ========================================
// РЕКЛАМА (ADS)
// ========================================

/** Создать рекламный пост */
export async function createAdPost(adData) {
  const telegram_id = getTelegramId();
  const response = await api.post('/ads/create', adData, {
    params: { telegram_id }
  });
  return response.data;
}

/** Список рекламных постов (для админки) */
export async function getAdPosts(filters = {}) {
  const telegram_id = getTelegramId();
  const params = { telegram_id, limit: filters.limit || 20, offset: filters.offset || 0 };
  if (filters.status) params.status = filters.status;
  if (filters.scope) params.scope = filters.scope;
  const response = await api.get('/ads/list', { params });
  return response.data;
}

/** Получить рекламный пост по ID */
export async function getAdPost(adId) {
  const telegram_id = getTelegramId();
  const response = await api.get(`/ads/${adId}`, { params: { telegram_id } });
  return response.data;
}

/** Обновить рекламный пост */
export async function updateAdPost(adId, updateData) {
  const telegram_id = getTelegramId();
  const response = await api.patch(`/ads/${adId}`, updateData, {
    params: { telegram_id }
  });
  return response.data;
}

/** Удалить рекламный пост */
export async function deleteAdPost(adId) {
  const telegram_id = getTelegramId();
  const response = await api.delete(`/ads/${adId}`, { params: { telegram_id } });
  return response.data;
}

/** Одобрить рекламный пост */
export async function approveAdPost(adId) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/ads/${adId}/approve`, null, {
    params: { telegram_id }
  });
  return response.data;
}

/** Отклонить рекламный пост */
export async function rejectAdPost(adId, rejectReason = null) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/ads/${adId}/reject`, {
    reject_reason: rejectReason
  }, {
    params: { telegram_id }
  });
  return response.data;
}

/** Пауза / снять паузу */
export async function pauseAdPost(adId) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/ads/${adId}/pause`, null, {
    params: { telegram_id }
  });
  return response.data;
}

export async function resumeAdPost(adId) {
  const telegram_id = getTelegramId();
  const response = await api.post(`/ads/${adId}/resume`, null, {
    params: { telegram_id }
  });
  return response.data;
}

/** Получить рекламные посты для подмешивания в ленту */
export async function getAdsForFeed(limit = 3) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/ads/feed/active', {
      params: { telegram_id, limit }
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
    const telegram_id = getTelegramId();
    await api.post(`/ads/${adId}/impression`, null, {
      params: { telegram_id }
    });
  } catch (error) {
    // Тихо проглатываем — трекинг не должен ломать UX
    console.warn('Ad impression tracking failed:', error);
  }
}

/** Трекинг клика по CTA */
export async function trackAdClick(adId) {
  try {
    const telegram_id = getTelegramId();
    await api.post(`/ads/${adId}/click`, null, {
      params: { telegram_id }
    });
  } catch (error) {
    console.warn('Ad click tracking failed:', error);
  }
}

/** Статистика по рекламному посту */
export async function getAdStats(adId) {
  const telegram_id = getTelegramId();
  const response = await api.get(`/ads/${adId}/stats`, {
    params: { telegram_id }
  });
  return response.data;
}

/** Сводная статистика рекламы */
export async function getAdOverviewStats() {
  const telegram_id = getTelegramId();
  const response = await api.get('/ads/stats/overview', {
    params: { telegram_id }
  });
  return response.data;
}


// ========================================
// УВЕДОМЛЕНИЯ (NOTIFICATIONS)
// ========================================

/** Получить настройки уведомлений */
export async function getNotificationSettings() {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/notifications/settings', {
      params: { telegram_id }
    });
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
    const telegram_id = getTelegramId();
    const response = await api.patch('/notifications/settings', settings, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления настроек уведомлений:', error);
    throw error;
  }
}


// ===== CAMPUS MANAGEMENT =====

export async function getUnboundUsers(search = '', limit = 100, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const params = { telegram_id, limit, offset };
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
    const telegram_id = getTelegramId();
    const response = await api.post('/admin/campuses/bind-user', {
      user_id: userId,
      campus_id: campusId,
      university: university,
      city: city,
    }, { params: { telegram_id } });
    return response.data;
  } catch (error) {
    console.error('Ошибка привязки к кампусу:', error);
    throw error;
  }
}

export async function unbindUserFromCampus(userId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/admin/campuses/unbind-user', {
      user_id: userId,
    }, { params: { telegram_id } });
    return response.data;
  } catch (error) {
    console.error('Ошибка отвязки от кампуса:', error);
    throw error;
  }
}


export { api };

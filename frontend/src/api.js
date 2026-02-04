// ===== 📄 ФАЙЛ: frontend/src/api.js =====

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getTelegramId() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }
  return 999999;
}

export async function authWithTelegram(initData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/auth/telegram', { telegram_id });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function registerUser(userData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/auth/register', {
      telegram_id,
      ...userData,
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    console.error('Ответ сервера:', error.response?.data);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/users/me', {
      params: { telegram_id },
    });
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
    const params = { telegram_id, skip: 0, limit: 50 };
    
    // Категория
    if (filters.category && filters.category !== 'all') {
      params.category = filters.category;
    }
    
    // Университет
    if (filters.university && filters.university !== 'all') {
      params.university = filters.university;
    }
    
    // Институт
    if (filters.institute && filters.institute !== 'all') {
      params.institute = filters.institute;
    }
    
    // Теги (массив → comma-separated строка)
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      params.tags = filters.tags.join(',');
    }
    
    // Диапазон дат
    if (filters.dateRange && filters.dateRange !== 'all') {
      params.date_range = filters.dateRange;
    }
    
    // Сортировка
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
  try {
    const telegram_id = getTelegramId();
    const response = await api.post(`/comments/${commentId}/report`, {
      comment_id: commentId,
      reason,
      description
    }, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка отправки жалобы:', error);
    throw error;
  }
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
    
    // Категория
    if (filters.category && filters.category !== 'all') {
      params.category = filters.category;
    }
    
    // Университет
    if (filters.university && filters.university !== 'all') {
      params.university = filters.university;
    }
    
    // Институт
    if (filters.institute && filters.institute !== 'all') {
      params.institute = filters.institute;
    }
    
    // Статус
    if (filters.status && filters.status !== 'active') {
      params.status = filters.status;
    }
    
    // Вознаграждение
    if (filters.hasReward && filters.hasReward !== 'all') {
      params.has_reward = filters.hasReward;
    }
    
    // Срочность
    if (filters.urgency && filters.urgency !== 'all') {
      params.urgency = filters.urgency;
    }
    
    // Сортировка
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

export async function getMyRequests() {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/api/requests/my-items`, {
      params: { telegram_id }
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

export { api };
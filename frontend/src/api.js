import axios from 'axios';

// Базовый URL твоего backend сервера
const API_BASE_URL = 'http://localhost:8000';
const API_URL = API_BASE_URL;

// Создаём экземпляр axios с настройками
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== HELPER ФУНКЦИИ =====

// Получить telegram_id из Telegram Web App
function getTelegramId() {
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }
  // Для тестирования без Telegram возвращаем фейковый ID
  return 999999;
}

// ===== AUTH (Авторизация) =====

export async function authWithTelegram(initData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/auth/telegram', { telegram_id });
    return response.data; // Вернёт пользователя если он зарегистрирован
  } catch (error) {
    if (error.response?.status === 404) {
      // Пользователь не найден - нужна регистрация
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

// ===== USERS (Пользователи) =====

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

// ===== POSTS (Посты) - ОБНОВЛЕНО =====

export async function getPosts({ category, university, course } = {}) {
  try {
    const telegram_id = getTelegramId();
    const params = { telegram_id, skip: 0, limit: 50 };
    
    if (category && category !== 'all') {
      params.category = category;
    }
    if (university) {
      params.university = university;
    }
    if (course) {
      params.course = course;
    }

    const response = await api.get('/posts/feed', { params });
    return response.data; // Возвращает { items: [], total, has_more }
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

export async function createPost(postData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/posts/create', postData, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    throw error;
  }
}

export async function updatePost(postId, postData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.patch(`/posts/${postId}`, postData, {
      params: { telegram_id }
    });
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

// ===== COMMENTS (Комментарии) - ОБНОВЛЕНО =====

export async function getPostComments(postId) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get(`/posts/${postId}/comments`, {
      params: { telegram_id }
    });
    // ✅ Возвращаем только массив items
    return response.data.items || []; 
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    return []; // ✅ Пустой массив при ошибке
  }
}

export async function createComment(postId, body, parentId = null) {
  try {
    const telegram_id = getTelegramId();
    console.log('createComment вызван:', postId, body, parentId);
    
    if (!body || body.trim().length === 0) {
      console.error('Body пустой!', body);
      throw new Error('Тело комментария обязательно');
    }
    
    const payload = {
      post_id: postId,
      body: body.trim(),
      is_anonymous: false,
      parent_id: parentId
    };
    
    console.log('payload:', payload);
    
    const response = await api.post(`/posts/${postId}/comments`, payload, {
      params: { telegram_id },
    });
    
    console.log('Ответ сервера:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    console.error('Детали:', error.response?.data);
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

// ===== REQUESTS (ОБНОВЛЕНО) =====

/**
 * Создать запрос
 */
export async function createRequest(requestData) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/api/requests/create', requestData, {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания запроса:', error);
    throw error;
  }
}

/**
 * Получить ленту запросов (с умной сортировкой)
 * category: 'study' | 'help' | 'hangout' | 'all' | null
 */
export async function getRequestsFeed(category = null, limit = 20, offset = 0) {
  try {
    const telegram_id = getTelegramId();
    const params = { limit, offset };
    
    if (telegram_id) {
      params.telegram_id = telegram_id;
    }
    
    if (category && category !== 'all') {
      params.category = category;
    }
    
    const response = await api.get('/api/requests/feed', { params });
    return response.data; // { items: [], total, has_more }
  } catch (error) {
    console.error('Ошибка получения запросов:', error);
    return { items: [], total: 0, has_more: false };
  }
}

/**
 * Получить запрос по ID
 */
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

/**
 * Обновить запрос
 */
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

/**
 * Удалить запрос
 */
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

/**
 * Получить мои запросы
 */
export async function getMyRequests() {
  try {
    const telegram_id = getTelegramId();
    const response = await api.get('/api/requests/my/list', {
      params: { telegram_id }
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка получения моих запросов:', error);
    return [];
  }
}

/**
 * Откликнуться на запрос
 */
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

/**
 * Получить отклики на мой запрос (только для автора)
 */
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

/**
 * Удалить отклик (только свой)
 */
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

// ===== DATING API =====

/**
 * Получить ленту профилей для знакомств
 */
export async function getDatingFeed(limit = 20, offset = 0, filters = {}) {
  const params = new URLSearchParams({
    telegram_id: getTelegramId(),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  if (filters.university) params.append('university', filters.university);
  if (filters.institute) params.append('institute', filters.institute);
  if (filters.course) params.append('course', filters.course.toString());

  const response = await fetch(`${API_URL}/dating/feed?${params}`);
  if (!response.ok) throw new Error('Failed to fetch dating feed');
  return response.json();
}

/**
 * Лайкнуть пользователя
 */
export async function likeUser(userId) {
  const response = await fetch(`${API_URL}/dating/like?telegram_id=${getTelegramId()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked_id: userId }),
  });
  if (!response.ok) throw new Error('Failed to like user');
  return response.json();
}

/**
 * Получить список тех, кто лайкнул меня
 */
export async function getWhoLikedMe(limit = 20, offset = 0) {
  const params = new URLSearchParams({
    telegram_id: getTelegramId(),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  const response = await fetch(`${API_URL}/dating/likes?${params}`);
  if (!response.ok) throw new Error('Failed to fetch likes');
  return response.json();
}

/**
 * Получить мои мэтчи
 */
export async function getMyMatches(limit = 20, offset = 0) {
  const params = new URLSearchParams({
    telegram_id: getTelegramId(),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  const response = await fetch(`${API_URL}/dating/matches?${params}`);
  if (!response.ok) throw new Error('Failed to fetch matches');
  return response.json();
}

/**
 * Получить статистику знакомств
 */
export async function getDatingStats() {
  const response = await fetch(`${API_URL}/dating/stats?telegram_id=${getTelegramId()}`);
  if (!response.ok) throw new Error('Failed to fetch dating stats');
  return response.json();
}

/**
 * Обновить настройки приватности
 */
export async function updateDatingSettings(settings) {
  const response = await fetch(`${API_URL}/me/dating-settings?telegram_id=${getTelegramId()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to update dating settings');
  return response.json();
}

/**
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ: создать моковых пользователей
 */
export async function generateMockDatingData() {
  const response = await fetch(`${API_URL}/dev/generate-mock-dating-data?telegram_id=${getTelegramId()}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate mock data');
  return response.json();
}

export { api };
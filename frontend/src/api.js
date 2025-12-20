import axios from 'axios';


// Базовый URL твоего backend сервера
const API_BASE_URL = 'http://localhost:8000';


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


// ===== POSTS (Посты) =====


export async function getPosts({ category, university, course } = {}) {
  try {
    const telegram_id = getTelegramId();
    const params = { telegram_id };
    
    if (category && category !== 'all') {
      params.category = category;
    }
    if (university) {
      params.university = university;
    }
    if (course) {
      params.course = course;
    }

    const response = await api.get('/posts', { params });
    return { items: response.data, next_cursor: null };
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    return { items: [], next_cursor: null };
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
    const response = await api.post('/posts', postData, {
      params: { telegram_id },
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    throw error;
  }
}


// ===== COMMENTS (Комментарии) =====


export async function getPostComments(postId) {
  try {
    const response = await api.get(`/posts/${postId}/comments`);
    return response.data;
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    return [];
  }
}


export async function createComment(postId, text) {
  try {
    const telegram_id = getTelegramId();
    const response = await api.post('/comments', {
      post_id: postId,
      text: text,
    }, {
      params: { telegram_id },
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка создания комментария:', error);
    throw error;
  }
}


// ===== LIKES (Лайки) =====


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


export async function likeComment(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/like`);
    return response.data;
  } catch (error) {
    console.error('Ошибка лайка комментария:', error);
    throw error;
  }
}

export { api };
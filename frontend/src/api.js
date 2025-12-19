import { MOCK_POSTS } from './types';

// Mock API функции (пока без реального backend)

export async function getPosts({ category } = {}) {
  // Имитация задержки сети
  await new Promise(resolve => setTimeout(resolve, 300));
  
  let posts = [...MOCK_POSTS];
  
  if (category && category !== 'all') {
    posts = posts.filter(p => p.category === category);
  }
  
  return { items: posts, next_cursor: null };
}

export async function getPost(id) {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const post = MOCK_POSTS.find(p => p.id === id);
  return post || MOCK_POSTS[0];
}

export async function createPost(postData) {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    id: Date.now(),
    ...postData,
    author: 'Ты',
    time: 'только что',
    likes: 0,
    commentsCount: 0,
    views: 1
  };
}

export async function authWithTelegram(initData) {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    access_token: 'mock_token_12345',
    user: {
      id: 999,
      name: 'Тестовый пользователь',
    }
  };
}
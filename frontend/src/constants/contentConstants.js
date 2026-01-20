// ===== 📄 ФАЙЛ: src/constants/contentConstants.js =====

// ========================================
// 📰 POST CATEGORIES
// ========================================

export const POST_CATEGORIES = [
  { value: 'news', label: 'Новости', icon: '📰', color: '#3b82f6' },
  { value: 'events', label: 'События', icon: '🎉', color: '#f59e0b' },
  { value: 'confessions', label: 'Признания', icon: '💭', color: '#ec4899' },
  { value: 'lost_found', label: 'Находки', icon: '🔍', color: '#10b981' }
];

export const POST_CATEGORY_LABELS = {
  news: 'Новости',
  events: 'События',
  confessions: 'Признания',
  lost_found: 'Находки'
};

// ========================================
// 📚 REQUEST CATEGORIES
// ========================================

export const REQUEST_CATEGORIES = [
  { value: 'study', label: 'Учёба', icon: '📚', color: '#3b82f6' },
  { value: 'help', label: 'Помощь', icon: '🤝', color: '#10b981' },
  { value: 'hangout', label: 'Тусовки', icon: '🎉', color: '#f59e0b' }
];

export const REQUEST_CATEGORY_LABELS = {
  study: 'Учёба',
  help: 'Помощь',
  hangout: 'Тусовки'
};

// ========================================
// 📏 POST LIMITS
// ========================================

export const POST_LIMITS = {
  TITLE_MAX: 100,
  BODY_MAX: 500,
  TAGS_MAX: 5,
  IMAGES_MAX: 3,
  FILE_SIZE_MAX: 5 * 1024 * 1024, // 5MB
};

// ========================================
// 📏 REQUEST LIMITS
// ========================================

export const REQUEST_LIMITS = {
  TITLE_MAX: 200,
  BODY_MAX: 1000,
  TAGS_MAX: 5,
  RESPONSES_MAX: 5,
  EXPIRES_DEFAULT_HOURS: 48,
};

// ========================================
// 🏷️ TAGS (общие для постов и запросов)
// ========================================

export const POPULAR_TAGS = [
  'python',
  'react',
  'помощь',
  'курсовая',
  'сопромат',
  'матан',
  'английский',
  'спорт'
];

// ========================================
// 🖼️ IMAGE SETTINGS
// ========================================

export const IMAGE_SETTINGS = {
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  MAX_DIMENSION: 1920,
  COMPRESSION_QUALITY: 0.8,
};
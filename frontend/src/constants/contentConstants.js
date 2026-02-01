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
// 📏 VALIDATION RULES
// Синхронизированы с backend (schemas.py)
// ========================================

export const POST_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 100,
  BODY_MIN: 10,
  BODY_MAX: 500,
  TAGS_MAX: 5,
  IMAGES_MAX: 3,
  FILE_SIZE_MAX: 5 * 1024 * 1024, // 5MB
};

export const REQUEST_LIMITS = {
  TITLE_MIN: 10,
  TITLE_MAX: 100,
  BODY_MIN: 20,
  BODY_MAX: 500,
  TAGS_MAX: 5,
  IMAGES_MAX: 3,
  RESPONSES_MAX: 5,
  EXPIRES_DEFAULT_HOURS: 48,
};

export const MARKET_LIMITS = {
  TITLE_MIN: 5,
  TITLE_MAX: 100,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 1000,
  PRICE_MIN: 0,
  PRICE_MAX: 1000000,
  IMAGES_MIN: 1,
  IMAGES_MAX: 5,
  CATEGORY_MAX: 50,
  LOCATION_MAX: 200,
};

// Для категории Lost & Found
export const LOST_FOUND_LIMITS = {
  ITEM_DESCRIPTION_MIN: 3,
  ITEM_DESCRIPTION_MAX: 500,
  LOCATION_MIN: 3,
  LOCATION_MAX: 200,
  REWARD_VALUE_MAX: 255,
};

// Для категории Events
export const EVENT_LIMITS = {
  NAME_MIN: 3,
  NAME_MAX: 200,
  LOCATION_MIN: 3,
  LOCATION_MAX: 200,
  CONTACT_MAX: 255,
};

// ========================================
// 💬 VALIDATION MESSAGES
// Готовые сообщения для форм
// ========================================

export const VALIDATION_MESSAGES = {
  // Posts
  POST_TITLE_MIN: `Минимум ${POST_LIMITS.TITLE_MIN} символа`,
  POST_TITLE_MAX: `Максимум ${POST_LIMITS.TITLE_MAX} символов`,
  POST_BODY_MIN: `Минимум ${POST_LIMITS.BODY_MIN} символов`,
  POST_BODY_MAX: `Максимум ${POST_LIMITS.BODY_MAX} символов`,
  
  // Requests
  REQUEST_TITLE_MIN: `Минимум ${REQUEST_LIMITS.TITLE_MIN} символов`,
  REQUEST_TITLE_MAX: `Максимум ${REQUEST_LIMITS.TITLE_MAX} символов`,
  REQUEST_BODY_MIN: `Минимум ${REQUEST_LIMITS.BODY_MIN} символов`,
  REQUEST_BODY_MAX: `Максимум ${REQUEST_LIMITS.BODY_MAX} символов`,
  
  // Market
  MARKET_TITLE_MIN: `Минимум ${MARKET_LIMITS.TITLE_MIN} символов`,
  MARKET_TITLE_MAX: `Максимум ${MARKET_LIMITS.TITLE_MAX} символов`,
  MARKET_DESCRIPTION_MIN: `Минимум ${MARKET_LIMITS.DESCRIPTION_MIN} символов`,
  MARKET_DESCRIPTION_MAX: `Максимум ${MARKET_LIMITS.DESCRIPTION_MAX} символов`,
  
  // Lost & Found
  LOST_FOUND_ITEM_MIN: `Минимум ${LOST_FOUND_LIMITS.ITEM_DESCRIPTION_MIN} символа`,
  LOST_FOUND_LOCATION_MIN: `Минимум ${LOST_FOUND_LIMITS.LOCATION_MIN} символа`,
  
  // Events
  EVENT_NAME_MIN: `Минимум ${EVENT_LIMITS.NAME_MIN} символа`,
  EVENT_LOCATION_MIN: `Минимум ${EVENT_LIMITS.LOCATION_MIN} символа`,
  
  // Универсальные
  IMAGES_MAX: (count) => `Максимум ${count} изображений`,
  IMAGES_MIN: (count) => `Минимум ${count} изображение`,
  TAGS_MAX: (count) => `Максимум ${count} тегов`,
  REQUIRED_FIELD: 'Это поле обязательно',
};

// ========================================
// 🏷️ TAGS
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

// ========================================
// 🎯 MENU ACTIONS
// ========================================

export const MENU_ACTIONS = {
  EDIT: 'edit',
  DELETE: 'delete',
  COPY: 'copy',
  REPORT: 'report',
  SHARE: 'share',
};
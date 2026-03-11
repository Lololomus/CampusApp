// ===== 📄 ФАЙЛ: frontend/src/utils/types.js =====

// Mock данные для разработки

export const MOCK_USER = {
  id: 999,
  name: 'Алексей Смирнов',
  age: 21,
  university: 'МГСУ',
  institute: 'ИЦИТ',
  course: 3,
  group: 'ИЦ-31',
  bio: 'Кожу на React, люблю кофе и котиков.',
  avatar: null,
  stats: {
    posts: 12,
    comments: 48
  }
};

export const MOCK_POSTS = [
  {
    id: 1,
    uni: 'МГСУ',
    institute: 'ИСА',
    course: 2,
    author: 'Алексей К.',
    time: '2 часа назад',
    title: 'Помощь с сопроматом, горит дедлайн!',
    body: 'Ребят, кто шарит за эпюры? Не могу сдать расчетку преподу, горит дедлайн завтра! С меня кофе или шоколадка 🍫. Нужно объяснить тему изгиба балки, вообще не понимаю как строить.',
    tags: ['сопромат', 'помощь', 'срочно'],
    category: 'study',
    likes: 42,
    commentsCount: 15,
    views: 1205
  },
  {
    id: 2,
    uni: 'РУК',
    institute: 'Юридический',
    course: 4,
    author: 'Мария В.',
    time: '5 часов назад',
    title: 'Сбор на волейбол сегодня вечером',
    body: 'Собираемся в зале корпуса А в 18:00. Нам нужно еще 2 человека. Уровень любительский, чисто поиграть в кайф. Мяч есть, сетка натянута.',
    tags: ['спорт', 'волейбол', 'движ'],
    category: 'hangout',
    likes: 156,
    commentsCount: 28,
    views: 3400
  },
  {
    id: 3,
    uni: 'МГСУ',
    institute: 'ИЭУИС',
    course: 1,
    author: 'Дмитрий С.',
    time: '1 день назад',
    title: 'Забыл зарядку в 305 аудитории',
    body: 'Кто сможет забрать и передать вечером в общаге на Лосинке? Буду очень благодарен! Зарядка белая Type-C.',
    tags: ['общага', 'помощь', 'потеряшка'],
    category: 'help',
    likes: 24,
    commentsCount: 3,
    views: 890
  }
];

export const MOCK_COMMENTS = [
  {
    id: 101,
    author: 'Мария В.',
    time: '2ч',
    text: 'Слушай, а в 305 аудитории вроде ремонт был? Ты уверен что там оставил?',
    likes: 5,
    replies: [
      {
        id: 102,
        author: 'Дмитрий С.',
        time: '1ч',
        text: 'Точно там, я заходил проверить расписание и забыл на подоконнике.',
        likes: 2,
        replies: []
      }
    ]
  },
  {
    id: 103,
    author: 'Иван К.',
    time: '30м',
    text: 'Могу забрать, я как раз в корпусе. Напиши в лс.',
    likes: 1,
    replies: []
  }
];

/**
 * @typedef {'dating' | 'study' | 'help' | 'hangout'} DatingMode
 */

/**
 * @typedef {Object} DatingProfile
 * @property {number} id
 * @property {number} telegram_id
 * @property {string} name
 * @property {number|null} age
 * @property {string|null} bio
 * @property {string|null} avatar
 * @property {string} university
 * @property {string} institute
 * @property {number|null} course
 * @property {string|null} group
 * @property {string[]} interests
 * @property {Post|null} active_post
 */

/**
 * @typedef {Object} Match
 * @property {number} id
 * @property {string} matched_at
 * @property {Object} matched_user
 */

// ========== ONBOARDING КОНСТАНТЫ ==========
export const UNIVERSITIES = ['МГСУ', 'РУК', 'МГУ', 'ВШЭ', 'МГТУ', 'РАНХиГС', 'Другой'];

export const INSTITUTES = ['ИЦИТ', 'ИСА', 'ИЭУИС', 'Юридический', 'Экономический', 'Менеджмент', 'Гостиничный сервис', 'Другой'];

export const COURSES = [1, 2, 3, 4, 5, 6];

// ========== ✅ НОВЫЕ КОНСТАНТЫ (POSTS & POLLS) ==========

// Типы вознаграждений для Lost & Found
export const REWARD_TYPES = {
  MONEY: 'money',
  GIFT: 'gift',
  FAVOR: 'favor',
  NONE: 'none'
};

export const REWARD_TYPE_LABELS = {
  [REWARD_TYPES.MONEY]: 'Денежное вознаграждение',
  [REWARD_TYPES.GIFT]: 'Подарок',
  [REWARD_TYPES.FAVOR]: 'Услуга',
  [REWARD_TYPES.NONE]: 'Без вознаграждения'
};

export const REWARD_TYPE_ICONS = {
  [REWARD_TYPES.MONEY]: '💰',
  [REWARD_TYPES.GIFT]: '🎁',
  [REWARD_TYPES.FAVOR]: '🤝',
  [REWARD_TYPES.NONE]: '❌'
};

// Типы опросов
export const POLL_TYPES = {
  REGULAR: 'regular',
  QUIZ: 'quiz'
};

export const POLL_TYPE_LABELS = {
  [POLL_TYPES.REGULAR]: 'Обычный опрос',
  [POLL_TYPES.QUIZ]: 'Викторина (с правильным ответом)'
};

// ========== КАТЕГОРИИ ПОСТОВ ==========
export const CATEGORIES = [
  { value: 'news', label: 'Новости', icon: '📰' },
  { value: 'events', label: 'События', icon: '🎉' },
  { value: 'confessions', label: 'Признания', icon: '💭' },
  { value: 'lost_found', label: 'Находки', icon: '🔍' },
  { value: 'polls', label: 'Опросы', icon: '📊' },
];

// Цвета для опросов
export const POLL_COLORS = {
  primary: '#8B5CF6',
  secondary: '#A78BFA',
  gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
};

// ===== TODO: APP CONTACT CONTROL (POST-TG FLOW) =====
// TODO(APP_CONTROL): Добавить настройку в профиле "Режим входящих":
// - allow_direct_tg (можно писать сразу в TG)
// - approval_only (писать только после подтверждения в приложении)
//
// TODO(APP_CONTROL): Для market_contact:
// - если approval_only, создавать inbox-уведомление с действиями "Принять/Отклонить"
// - "Принять" -> разрешить контакт и отдать TG-ссылку/контакт покупателю
// - "Отклонить" -> закрыть запрос без передачи контакта
//
// TODO(APP_CONTROL): Для request_response:
// - если approval_only, автор запроса подтверждает отклик в приложении
// - "Принять" -> открыть контакты/чат между автором и откликнувшимся
// - "Отклонить" -> оставить отклик в статусе declined
//
// TODO(APP_CONTROL): Кнопки в NotificationsScreen должны вызывать backend action API,
// а не только локально менять состояние карточки.
//
// TODO(APP_CONTROL): Протоколировать решения (accepted/declined + timestamp + actor_id),
// чтобы считать конверсию и видеть в истории сделки/запроса.

import theme from '../theme';

export const CREATE_CONTENT_POST_CATEGORIES = [
  { value: 'general', label: 'Без темы', icon: '', color: theme.colors.textTertiary },
  { value: 'help', label: 'Помощь', icon: '🤝', color: theme.colors.help },
  { value: 'news', label: 'Новости', icon: '📰', color: theme.colors.premium.primary },
  { value: 'memes', label: 'Мемы', icon: '🤡', color: theme.colors.premium.primary },
  { value: 'confessions', label: 'Признания', icon: '💭', color: theme.colors.premium.primary },
  { value: 'polls', label: 'Опросы', icon: '📊', color: theme.colors.premium.primary },
  { value: 'events', label: 'События', icon: '🎉', color: theme.colors.premium.primary },
  { value: 'lost_found', label: 'Находки', icon: '🔍', color: theme.colors.premium.primary },
];

export const CREATE_CONTENT_REQUEST_CATEGORIES = [
  { value: 'help', label: 'Помощь', icon: '🤝', color: theme.colors.premium.primary },
  { value: 'study', label: 'Учёба', icon: '📚', color: theme.colors.premium.primary },
  { value: 'hangout', label: 'Движ', icon: '🔥', color: theme.colors.premium.primary },
];

export const CREATE_CONTENT_SUGGESTED_TAGS = [
  'python',
  'react',
  'помощь',
  'курсач',
  'сопромат',
  'общага',
  'ищу_команду',
];

export const CREATE_CONTENT_CATEGORY_CAPABILITIES = {
  general: {
    allowImages: true,
    allowPoll: true,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
  help: {
    allowImages: true,
    allowPoll: false,
    forceAnonymous: false,
    allowAnonymousToggle: true,
    allowReward: true,
    allowDeadline: true,
  },
  news: {
    allowImages: true,
    allowPoll: true,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
  memes: {
    allowImages: true,
    allowPoll: false,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
  events: {
    allowImages: true,
    allowPoll: true,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
  confessions: {
    allowImages: false,
    allowPoll: false,
    forceAnonymous: true,
    allowAnonymousToggle: false,
  },
  lost_found: {
    allowImages: true,
    allowPoll: false,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
  polls: {
    allowImages: false,
    allowPoll: true,
    forceAnonymous: false,
    allowAnonymousToggle: true,
  },
};

export const CREATE_CONTENT_POST_PLACEHOLDERS = {
  general: 'Заголовок\nЧто думаешь...',
  help: 'Что нужна помощь\nОпиши подробнее...',
  news: 'Заголовок поста\nРаскрой детали...',
  memes: 'Поделись мемом\nДобавь фото или подпись...',
  events: 'Название события\nДата, место, детали...',
  confessions: 'Коротко о главном\nВыскажи всё, что на душе...',
  lost_found: 'Что случилось\nПодробно опиши вещь...',
  polls: 'Вопрос для опроса\nДобавь контекст, если нужно...',
  default: 'Заголовок\nПодробности...',
};

export const CREATE_CONTENT_REQUEST_PLACEHOLDERS = {
  study: 'Нужен конспект, помощь с лабой или билет?',
  help: 'Что случилось? Опиши проблему...',
  hangout: 'Кого ищешь? Настолки, бар, спорт...',
  default: 'Опиши суть запроса...',
};

export const CREATE_CONTENT_REQUEST_REWARD_OPTIONS = [
  { value: 'none', label: 'Нет', icon: '❌' },
  { value: 'money', label: 'Деньги', icon: '💰' },
  { value: 'barter', label: 'Бартер', icon: '☕' },
];

export const CREATE_CONTENT_REQUEST_DEADLINE_OPTIONS = [
  { value: '3h', label: '3 часа' },
  { value: '24h', label: '24 часа' },
  { value: '3d', label: '3 дня' },
];

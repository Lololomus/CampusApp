// ===== 📄 ФАЙЛ: src/constants/datingConstants.js (БЕЗ LIFESTYLE) =====

// ===== LIMITS =====
export const MAX_PROMPTS = 3;
export const PROMPT_MAX_LENGTH = 150;
export const MAX_INTERESTS = 5;
export const MAX_GOALS = 2;
export const BIO_MIN_LENGTH = 10;
export const BIO_MAX_LENGTH = 200;
export const MAX_PHOTOS = 3;
export const MIN_AGE = 16;
export const MAX_AGE = 50;

// ===== GOALS =====
export const GOAL_OPTIONS = [
  { value: 'relationship', label: '💘 Отношения' },
  { value: 'friends', label: '🤝 Дружба' },
  { value: 'study', label: '📚 Учеба' },
  { value: 'hangout', label: '🎉 Тусовки' },
];

export const GOAL_LABELS = {
  'relationship': '💘 Отношения',
  'friends': '🤝 Дружба',
  'study': '📚 Учеба',
  'hangout': '🎉 Тусовки'
};

// ===== INTERESTS =====
export const INTEREST_OPTIONS = [
  { label: '💻 IT', value: 'it' },
  { label: '🎮 Игры', value: 'games' },
  { label: '📚 Книги', value: 'books' },
  { label: '🎵 Музыка', value: 'music' },
  { label: '🎬 Кино', value: 'movies' },
  { label: '⚽ Спорт', value: 'sport' },
  { label: '🎨 Творчество', value: 'art' },
  { label: '🌍 Путешествия', value: 'travel' },
  { label: '☕ Кофе', value: 'coffee' },
  { label: '🎉 Вечеринки', value: 'party' },
  { label: '📸 Фото', value: 'photo' },
  { label: '🍕 Еда', value: 'food' },
  { label: '🎓 Наука', value: 'science' },
  { label: '🚀 Стартапы', value: 'startup' },
  { label: '🏋️ Фитнес', value: 'fitness' },
];

export const INTEREST_LABELS = {
  it: '💻 IT',
  games: '🎮 Игры',
  books: '📚 Книги',
  music: '🎵 Музыка',
  movies: '🎬 Кино',
  sport: '⚽ Спорт',
  art: '🎨 Творчество',
  travel: '🌍 Путешествия',
  coffee: '☕ Кофе',
  party: '🎉 Вечеринки',
  photo: '📸 Фото',
  food: '🍕 Еда',
  science: '🎓 Наука',
  startup: '🚀 Стартапы',
  fitness: '🏋️ Фитнес',
};

// ===== PROMPTS (ЛЕДОКОЛЫ) =====
export const PROMPT_OPTIONS = [
  { 
    id: 'ideal_day', 
    question: 'Мой идеальный день в универе',
    category: '🎓 Студенческая жизнь',
    placeholder: 'Например: Пара отменилась, купил кофе и сижу в библиотеке...'
  },
  { 
    id: 'cant_live_without', 
    question: 'Я не могу жить без...',
    category: '💭 О тебе',
    placeholder: 'Например: Кофе после каждой пары и музыки в наушниках...'
  },
  { 
    id: 'skip_class', 
    question: 'Лучший способ прогулять пару',
    category: '🎓 Студенческая жизнь',
    placeholder: 'Например: Пойти в антикафе играть в настолки...'
  },
  { 
    id: 'be_friends', 
    question: 'Я стану твоим другом, если ты...',
    category: '🤝 Дружба',
    placeholder: 'Например: Готов идти на хакатон в 3 ночи за пиццей...'
  },
  { 
    id: 'exam_session', 
    question: 'Сессия для меня это...',
    category: '🎓 Студенческая жизнь',
    placeholder: 'Например: Кофе, паника, ещё кофе и чудо в последний день...'
  },
  { 
    id: 'after_class', 
    question: 'После учёбы я обычно...',
    category: '🏃 Образ жизни',
    placeholder: 'Например: Иду в зал или зависаю в коворкинге...'
  },
  { 
    id: 'favorite_place', 
    question: 'Моя любимая столовка/кафе',
    category: '📍 Места',
    placeholder: 'Например: Буфет на 3 этаже, там самые вкусные чизкейки...'
  },
  { 
    id: 'student_hack', 
    question: 'Мой студенческий лайфхак',
    category: '💡 Советы',
    placeholder: 'Например: Сесть на первую парту = автоматом +2 к оценке...'
  },
  { 
    id: 'want_to_visit', 
    question: 'Хочу сходить в...',
    category: '🎯 Интересы',
    placeholder: 'Например: Третьяковку, но уже полгода не доходят руки...'
  },
  { 
    id: 'dream_internship', 
    question: 'Мечтаю поехать на стажировку в...',
    category: '🚀 Карьера',
    placeholder: 'Например: Европу, но пока экономлю на визу...'
  }
];

// Группировка промптов по категориям
export const PROMPTS_BY_CATEGORY = PROMPT_OPTIONS.reduce((acc, prompt) => {
  if (!acc[prompt.category]) {
    acc[prompt.category] = [];
  }
  acc[prompt.category].push(prompt);
  return acc;
}, {});

// ===== GENDER & LOOKING FOR =====
export const GENDER_OPTIONS = [
  { value: 'male', label: '👨 Парень' },
  { value: 'female', label: '👩 Девушка' }
];

export const GENDER_LABELS = {
  'male': '👨 Парень',
  'female': '👩 Девушка'
};

export const LOOKING_FOR_OPTIONS = [
  { value: 'male', label: '👨 Парней' },
  { value: 'female', label: '👩 Девушек' },
  { value: 'all', label: '👥 Неважно' }
];

export const LOOKING_FOR_LABELS = {
  'male': '👨 Парней',
  'female': '👩 Девушек',
  'all': '👥 Неважно'
};
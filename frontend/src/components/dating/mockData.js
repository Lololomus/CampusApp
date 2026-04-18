// ===== 📄 ФАЙЛ: src/components/dating/mockData.js =====
// Моковые данные для разработки. НЕ используются в продакшене.

const nodeEnv = import.meta.env.MODE;
const useMockFromEnv = import.meta.env.VITE_USE_MOCK === 'true';

export const USE_MOCK_DATA = nodeEnv === 'development' || useMockFromEnv;

// 🎨 SVG placeholder генератор
export const createAvatar = (letter, gradient1, gradient2, size = 400) => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size * 1.2}'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:${gradient1};stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:${gradient2};stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grad)'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial,sans-serif' font-size='${size * 0.35}' font-weight='bold' fill='white' text-anchor='middle' dy='.35em'%3E${letter}%3C/text%3E%3C/svg%3E`;
};

export const MOCK_PROFILES = [
  { 
    id: 1, name: 'Алексей', age: 22, 
    bio: 'Люблю кодить по ночам, пить кофе литрами и участвовать в хакатонах.',
    university: 'МГУ', institute: 'ВМК', course: 3,
    interests: ['it', 'games', 'coffee', 'startup', 'music'],
    goals: ['relationship', 'study'],
    prompts: { question: 'Идеальное свидание?', answer: 'Ночной хакатон с пиццей и Red Bull, потом встретить рассвет на крыше 🌅' },
    photos: [
      { url: createAvatar('А', '%23667eea', '%23764ba2') },
      { url: createAvatar('А', '%235e72e4', '%238e54e9') }
    ],
    match_reason: 'Из твоего вуза',
    common_interests: ['it', 'coffee'],
    common_goals: ['study'],
  },
  { 
    id: 2, name: 'Мария', age: 20, 
    bio: 'Фотограф, ищу моделей для портфолио 📸\n\nЛюблю творчество и искусство.',
    university: 'ВШЭ', institute: 'Дизайн', course: 2,
    interests: ['photo', 'art', 'music', 'coffee', 'books'],
    goals: ['friends', 'hangout'],
    prompts: { question: 'Что не могу пропустить?', answer: 'Закат в красивом месте — всегда беру камеру и ловлю момент' },
    photos: [{ url: createAvatar('М', '%23f093fb', '%23f5576c') }],
    match_reason: '3 общих интереса',
    common_interests: ['music', 'coffee', 'art'],
    common_goals: ['friends'],
  },
  { 
    id: 3, name: 'Дмитрий', age: 23, 
    bio: 'Гитарист в поиске группы 🎸\n\nРок, метал, все что громко!',
    university: 'МГТУ', institute: 'ИБ', course: 4,
    interests: ['music', 'party', 'sport', 'travel'],
    goals: ['friends', 'hangout'],
    prompts: { question: 'Мой студенческий лайфхак', answer: 'Гитара на общаге = автоматически +100 к популярности' },
    photos: [{ url: createAvatar('Д', '%234facfe', '%2300f2fe') }],
    match_reason: null,
    common_interests: ['music'],
    common_goals: ['friends'],
  },
  { 
    id: 4, name: 'София', age: 21, 
    bio: 'Люблю спорт и здоровый образ жизни 🏋️\n\nИщу компанию для пробежек и зала.',
    university: 'МГСУ', institute: 'ИЦИТ', course: 3,
    interests: ['fitness', 'sport', 'food', 'travel', 'music'],
    goals: ['friends', 'relationship'],
    prompts: { question: 'После пар я...', answer: 'Сразу в зал! А потом протеиновый смузи и планы на вечер' },
    photos: [{ url: createAvatar('С', '%2343e97b', '%2338f9d7') }],
    match_reason: 'Ищет то же, что и ты',
    common_interests: [],
    common_goals: ['friends'],
  },
  { 
    id: 5, name: 'Максим', age: 24, 
    bio: 'Стартапер, работаю над AI проектом 🚀\n\nВсегда рад новым знакомствам и нетворкингу.',
    university: 'РЭУ', institute: 'Экономический', course: 5,
    interests: ['startup', 'it', 'coffee', 'books', 'travel'],
    goals: ['study', 'friends'],
    prompts: { question: 'Мечта на стажировку', answer: 'Google в Калифорнии или OpenAI — хочу быть там, где создаётся будущее' },
    photos: [{ url: createAvatar('М', '%23fa709a', '%23fee140') }],
    match_reason: null,
    common_interests: ['it', 'startup'],
    common_goals: ['study', 'friends'],
  },
];

export const MOCK_LIKES = [
  {
    id: 101, name: 'Анна', age: 19, university: 'МГУ', institute: 'Журфак', course: 1,
    bio: 'Люблю театры и литературу 🎭\n\nМечтаю стать журналистом и писать о культуре.',
    photos: [
      { url: createAvatar('А', '%23ff6b6b', '%23ee5a6f', 600) },
      { url: createAvatar('А', '%23ff8787', '%23f06595', 600) },
      { url: createAvatar('А', '%23ff5e5e', '%23d946ef', 600) },
    ],
    interests: ['books', 'art', 'movies', 'coffee'],
    goals: ['friends', 'hangout'],
    common_interests: ['books', 'coffee'],
    common_goals: ['friends'],
    match_reason: '2 общих интереса',
    prompts: { question: 'Какую последнюю книгу прочитал?', answer: 'Перечитываю Достоевского — каждый раз нахожу что-то новое 📖' },
  },
  {
    id: 102, name: 'Илья', age: 22, university: 'МФТИ', institute: 'ФРКТ', course: 4,
    bio: 'Физтех, люблю математику и шахматы ♟️\n\nРешаю олимпиадные задачи для души.',
    photos: [
      { url: createAvatar('И', '%235b21b6', '%237c3aed', 600) },
      { url: createAvatar('И', '%236d28d9', '%238b5cf6', 600) },
    ],
    interests: ['science', 'books', 'games', 'coffee'],
    goals: ['study', 'friends'],
    common_interests: [],
    common_goals: ['study', 'friends'],
    match_reason: 'Из твоего вуза',
  },
  {
    id: 103, name: 'Катя', age: 20, university: 'ВШЭ', institute: 'Дизайн', course: 2,
    bio: 'UI/UX дизайнер и художник 🎨\n\nРисую акварелью и делаю крутые интерфейсы.',
    photos: [
      { url: createAvatar('К', '%2314b8a6', '%2306b6d4', 600) },
      { url: createAvatar('К', '%2310b981', '%233b82f6', 600) },
      { url: createAvatar('К', '%230891b2', '%235eead4', 600) },
    ],
    interests: ['art', 'photo', 'coffee', 'music', 'travel'],
    goals: ['friends', 'relationship'],
    common_interests: ['art', 'photo', 'travel'],
    common_goals: ['friends'],
    match_reason: '3 общих интереса',
    prompts: { question: 'Figma или Adobe XD?', answer: 'Только Figma! Там все плагины которые нужны 🔥' },
  },
  {
    id: 104, name: 'Даниил', age: 23, university: 'МГТУ', institute: 'ИБ', course: 4,
    bio: 'Гитарист и меломан 🎸\n\nИграю в группе, пишу свою музыку.',
    photos: [{ url: createAvatar('Д', '%231e3a8a', '%232563eb', 600) }],
    interests: ['music', 'party', 'sport', 'coffee'],
    goals: ['friends', 'hangout'],
    common_interests: [],
    common_goals: ['friends'],
    match_reason: 'Твой факультет',
  },
  {
    id: 105, name: 'Полина', age: 21, university: 'МГСУ', institute: 'ИЦИТ', course: 3,
    bio: 'Спортсменка и фитнес-тренер 💪\n\nЗОЖ - мой образ жизни!',
    photos: [
      { url: createAvatar('П', '%23c026d3', '%23e879f9', 600) },
      { url: createAvatar('П', '%23a21caf', '%23f0abfc', 600) },
      { url: createAvatar('П', '%23be185d', '%23fb7185', 600) },
    ],
    interests: ['fitness', 'sport', 'food', 'travel', 'music'],
    goals: ['friends', 'relationship'],
    common_interests: ['music'],
    common_goals: ['friends'],
    match_reason: null,
    prompts: { question: 'Зал или пробежка утром?', answer: 'Зал всегда! Утренняя тренировка заряжает на весь день 💪' },
  },
  {
    id: 106, name: 'Артём', age: 24, university: 'РЭУ', institute: 'Экономический', course: 5,
    bio: 'Запускаю EdTech стартап 🚀\n\nВсегда рад новым знакомствам и идеям.',
    photos: [
      { url: createAvatar('А', '%23f97316', '%23fbbf24', 600) },
      { url: createAvatar('А', '%23ea580c', '%23fb923c', 600) },
    ],
    interests: ['startup', 'it', 'coffee', 'books', 'travel'],
    goals: ['study', 'friends'],
    common_interests: ['it', 'startup'],
    common_goals: ['study', 'friends'],
    match_reason: 'Новая анкета',
  },
];

export const MOCK_MATCHES = [
  {
    id: 201, user_id: 2, name: 'Анна', age: 19,
    bio: 'Люблю театры и литературу 🎭📚',
    university: 'МГУ', institute: 'Филологический', course: 1,
    photos: [{ url: createAvatar('А', '%23ff6b6b', '%23ee5a6f', 600), w: 600, h: 720 }],
    interests: ['books', 'art', 'coffee'], goals: ['friends', 'study'],
    common_interests: ['art', 'coffee'],
    common_goals: ['friends', 'study'],
    match_reason: '2 общих интереса',
    prompts: { question: 'Моя суперспособность?', answer: 'Могу процитировать "Мастера и Маргариту" целиком 📖' },
    matched_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    hours_left: 2, minutes_left: 0,
  },
  {
    id: 202, user_id: 3, name: 'Илья', age: 22,
    bio: 'Физтех, люблю математику и шахматы ♟️',
    university: 'МФТИ', institute: 'ФПМИ', course: 4,
    photos: [{ url: createAvatar('И', '%235b21b6', '%237c3aed', 600), w: 600, h: 720 }],
    interests: ['science', 'games', 'coffee'], goals: ['study', 'friends'],
    common_interests: [],
    common_goals: ['study', 'friends'],
    match_reason: 'Из твоего вуза',
    prompts: { question: 'Идеальное свидание?', answer: 'Партия в шахматы в Парке Горького + кофе' },
    matched_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    hours_left: 18, minutes_left: 0,
  },
  {
    id: 203, user_id: 4, name: 'Катя', age: 20,
    bio: 'UI/UX дизайнер и художник 🎨',
    university: 'ВШЭ', institute: 'Дизайн', course: 2,
    photos: [{ url: createAvatar('К', '%2314b8a6', '%2306b6d4', 600), w: 600, h: 720 }],
    interests: ['art', 'photo', 'coffee', 'travel'], goals: ['friends', 'relationship'],
    common_interests: ['art', 'coffee'],
    common_goals: ['friends'],
    match_reason: '2 общих интереса',
    prompts: { question: 'Figma или Adobe XD?', answer: 'Figma всегда! Collaborative design — это мощь 🔥' },
    matched_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    hours_left: 5, minutes_left: 0,
  },
];

// ===== 📄 ФАЙЛ: frontend/src/constants/universityData.js =====

// ========================================
// 🏫 КАМПУСЫ (единый источник правды)
// Используется: Onboarding, EditProfile, фильтры фида
// 
// Добавление нового кампуса:
// 1. Добавить объект в CAMPUSES
// 2. ID формат: {сокращение_вуза}_{город}_{уточнение}
// 3. Факультеты: массив строк + всегда 'Другой' последним
// ========================================

export const CAMPUSES = [
  // === РУК (Российский университет кооперации) ===
  {
    id: 'ruk_moscow',
    university: 'РУК',
    fullName: 'Российский университет кооперации',
    city: 'Москва',
    address: 'ул. Верхняя Красносельская, 11/5',
    short: 'РУК — Москва',
    faculties: ['ИСА', 'Юридический', 'Экономический', 'Менеджмент', 'Гостиничный сервис', 'Другой'],
  },
  {
    id: 'ruk_mytishchi',
    university: 'РУК',
    fullName: 'Российский университет кооперации',
    city: 'Мытищи',
    address: 'ул. Веры Волошиной, 12/30',
    short: 'РУК — Мытищи',
    faculties: ['Экономический', 'Товароведение', 'Другой'],
  },

  // === МГУ ===
  {
    id: 'mgu_moscow',
    university: 'МГУ',
    fullName: 'Московский государственный университет',
    city: 'Москва',
    address: '',
    short: 'МГУ — Москва',
    faculties: ['Мехмат', 'Физфак', 'ВМК', 'Филфак', 'Юрфак', 'Экономический', 'Другой'],
  },

  // === ВШЭ ===
  {
    id: 'hse_moscow',
    university: 'ВШЭ',
    fullName: 'Высшая школа экономики',
    city: 'Москва',
    address: '',
    short: 'ВШЭ — Москва',
    faculties: ['Экономика', 'Бизнес-информатика', 'Право', 'Гуманитарные науки', 'Другой'],
  },

  // === МГТУ ===
  {
    id: 'mgtu_moscow',
    university: 'МГТУ',
    fullName: 'МГТУ им. Баумана',
    city: 'Москва',
    address: '',
    short: 'МГТУ — Москва',
    faculties: ['ИУ', 'РК', 'МТ', 'СМ', 'ФН', 'Другой'],
  },

  // === РАНХиГС ===
  {
    id: 'ranepa_moscow',
    university: 'РАНХиГС',
    fullName: 'Российская академия народного хозяйства',
    city: 'Москва',
    address: '',
    short: 'РАНХиГС — Москва',
    faculties: ['ИПНБ', 'ИОН', 'Факультет права', 'ВШГУ', 'Другой'],
  },
];

// ========================================
// 📚 КУРСЫ
// ========================================

export const COURSES = [1, 2, 3, 4, 5, 6];

// ========================================
// 🔍 ХЕЛПЕРЫ
// ========================================

/**
 * Найти кампус по ID
 */
export const getCampusById = (campusId) => {
  return CAMPUSES.find(c => c.id === campusId) || null;
};

/**
 * Получить факультеты для кампуса
 */
export const getFacultiesForCampus = (campusId) => {
  const campus = getCampusById(campusId);
  return campus ? campus.faculties : [];
};

/**
 * Получить display-строку для кампуса
 * Пример: "РУК — Москва" или "КубГУ, Краснодар" (для custom)
 */
export const getCampusDisplayName = (user) => {
  if (user.campus_id) {
    const campus = getCampusById(user.campus_id);
    return campus ? campus.short : user.campus_id;
  }
  if (user.custom_university) {
    return user.custom_city 
      ? `${user.custom_university} — ${user.custom_city}`
      : user.custom_university;
  }
  return 'Не указано';
};

/**
 * Получить название университета (для фильтрации/отображения)
 */
export const getUniversityName = (user) => {
  if (user.campus_id) {
    const campus = getCampusById(user.campus_id);
    return campus?.university || '';
  }
  return user.custom_university || '';
};

/**
 * Получить город пользователя
 */
export const getUserCity = (user) => {
  if (user.campus_id) {
    const campus = getCampusById(user.campus_id);
    return campus?.city || '';
  }
  return user.custom_city || '';
};

/**
 * Поиск кампусов по тексту (для автокомплита)
 */
export const searchCampuses = (query) => {
  if (!query || query.length < 1) return CAMPUSES;
  
  const q = query.toLowerCase().trim();
  
  return CAMPUSES.filter(campus => {
    return (
      campus.university.toLowerCase().includes(q) ||
      campus.fullName.toLowerCase().includes(q) ||
      campus.city.toLowerCase().includes(q) ||
      campus.short.toLowerCase().includes(q)
    );
  });
};

/**
 * Получить уникальные университеты (для фильтров фида)
 */
export const getUniqueUniversities = () => {
  const seen = new Set();
  return CAMPUSES.reduce((acc, campus) => {
    if (!seen.has(campus.university)) {
      seen.add(campus.university);
      acc.push({ value: campus.university, label: campus.university });
    }
    return acc;
  }, []);
};

/**
 * Получить уникальные города (для фильтров фида)
 */
export const getUniqueCities = () => {
  const seen = new Set();
  return CAMPUSES.reduce((acc, campus) => {
    if (!seen.has(campus.city)) {
      seen.add(campus.city);
      acc.push({ value: campus.city, label: campus.city });
    }
    return acc;
  }, []);
};

// ========================================
// 📏 VALIDATION
// ========================================

export const ONBOARDING_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 50,
  USERNAME_MAX: 32,
  CUSTOM_UNIVERSITY_MIN: 2,
  CUSTOM_UNIVERSITY_MAX: 100,
  CUSTOM_CITY_MIN: 2,
  CUSTOM_CITY_MAX: 50,
  CUSTOM_FACULTY_MAX: 100,
  GROUP_MAX: 20,
};
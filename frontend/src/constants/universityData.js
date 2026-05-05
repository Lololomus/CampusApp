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

const GRAPH_ACCENTS = {
  tech: '#64D2FF',
  math: '#5E5CE6',
  science: '#32D74B',
  society: '#FF9F0A',
  medicine: '#FF375F',
  business: '#BF5AF2',
  creative: '#FF2D55',
  law: '#0A84FF',
  engineering: '#30D158',
  service: '#FFD60A',
  other: '#8E8E93',
};

const makeNode = (value, fullName, options = {}) => ({
  value,
  label: options.label || value,
  fullName: fullName || value,
  officialType: options.officialType || 'faculty',
});

const makeCluster = (id, label, accent, nodes) => ({
  id,
  label,
  accent,
  nodes: nodes.map(node => ({ ...node, cluster: label })),
});

const makeFacultyGraph = (center, clusters, otherLabel = 'Другое подразделение') => ({
  center,
  clusters,
  other: { ...makeNode('Другой', otherLabel, { officialType: 'other' }), cluster: 'Другое' },
});

const getGraphFacultyValues = (graph) => [
  ...(graph?.clusters || []).flatMap(cluster => (cluster.nodes || []).map(node => node.value)),
  ...(graph?.other ? [graph.other.value] : []),
];

const RUK_MOSCOW_GRAPH = makeFacultyGraph('РУК', [
  makeCluster('systems', 'Информационные системы', GRAPH_ACCENTS.tech, [
    makeNode('ИСА', 'Информационные системы и аналитика'),
  ]),
  makeCluster('business', 'Экономика и управление', GRAPH_ACCENTS.business, [
    makeNode('Экономический', 'Экономический факультет'),
    makeNode('Менеджмент', 'Менеджмент'),
    makeNode('Гостиничный сервис', 'Гостиничный сервис'),
  ]),
  makeCluster('law', 'Право', GRAPH_ACCENTS.law, [
    makeNode('Юридический', 'Юридический факультет'),
  ]),
]);

const RUK_MYTISHCHI_GRAPH = makeFacultyGraph('РУК', [
  makeCluster('business', 'Экономика и управление', GRAPH_ACCENTS.business, [
    makeNode('Экономический', 'Экономический факультет'),
    makeNode('Товароведение', 'Товароведение'),
  ]),
]);

const MSU_GRAPH = makeFacultyGraph('МГУ', [
  makeCluster('math', 'Математика и вычисления', GRAPH_ACCENTS.math, [
    makeNode('Мехмат', 'Механико-математический факультет'),
    makeNode('ВМК', 'Факультет вычислительной математики и кибернетики'),
  ]),
  makeCluster('science', 'Естественные науки', GRAPH_ACCENTS.science, [
    makeNode('Физфак', 'Физический факультет'),
  ]),
  makeCluster('humanities', 'Гуманитарное и общественное', GRAPH_ACCENTS.society, [
    makeNode('Филфак', 'Филологический факультет'),
    makeNode('Юрфак', 'Юридический факультет'),
    makeNode('Экономический', 'Экономический факультет'),
  ]),
]);

const HSE_GRAPH = makeFacultyGraph('ВШЭ', [
  makeCluster('math-it', 'Математика и IT', GRAPH_ACCENTS.tech, [
    makeNode('ФМ', 'Факультет математики'),
    makeNode('МИЭМ', 'Московский институт электроники и математики им. А.Н. Тихонова', { officialType: 'institute' }),
    makeNode('ФКН', 'Факультет компьютерных наук'),
  ]),
  makeCluster('economics-business', 'Экономика и бизнес', GRAPH_ACCENTS.business, [
    makeNode('ФЭН', 'Факультет экономических наук'),
    makeNode('ВШБ', 'Высшая школа бизнеса', { officialType: 'school' }),
    makeNode('МИЭФ', 'Международный институт экономики и финансов', { officialType: 'institute' }),
    makeNode('Банковский институт', 'Банковский институт', { officialType: 'institute' }),
    makeNode('Инноватика', 'Школа инноватики и предпринимательства', { officialType: 'school' }),
  ]),
  makeCluster('law-society', 'Право и общество', GRAPH_ACCENTS.law, [
    makeNode('Право', 'Факультет права'),
    makeNode('ВШЮА', 'Высшая школа юриспруденции и администрирования', { officialType: 'school' }),
    makeNode('ФСН', 'Факультет социальных наук'),
    makeNode('ФМЭМП', 'Факультет мировой экономики и мировой политики'),
  ]),
  makeCluster('humanities-creative', 'Гуманитарное и креатив', GRAPH_ACCENTS.creative, [
    makeNode('ФГН', 'Факультет гуманитарных наук'),
    makeNode('ФКИ', 'Факультет креативных индустрий'),
    makeNode('ШИЯ', 'Школа иностранных языков', { officialType: 'school' }),
  ]),
  makeCluster('science-city', 'Науки и город', GRAPH_ACCENTS.science, [
    makeNode('Физика', 'Факультет физики'),
    makeNode('Химия', 'Факультет химии'),
    makeNode('БиоБио', 'Факультет биологии и биотехнологии'),
    makeNode('ГеоГИТ', 'Факультет географии и геоинформационных технологий'),
    makeNode('Город', 'Факультет городского и регионального развития'),
    makeNode('ИСИЭЗ', 'Институт статистических исследований и экономики знаний', { officialType: 'institute' }),
  ]),
]);

const BMSTU_GRAPH = makeFacultyGraph('МГТУ', [
  makeCluster('it-control', 'IT и управление', GRAPH_ACCENTS.tech, [
    makeNode('ИУ', 'Информатика и системы управления'),
  ]),
  makeCluster('engineering', 'Инженерия и машины', GRAPH_ACCENTS.engineering, [
    makeNode('РК', 'Робототехника и комплексная автоматизация'),
    makeNode('МТ', 'Машиностроительные технологии'),
    makeNode('СМ', 'Специальное машиностроение'),
  ]),
  makeCluster('science', 'Фундаментальные науки', GRAPH_ACCENTS.math, [
    makeNode('ФН', 'Фундаментальные науки'),
  ]),
]);

const RANEPA_GRAPH = makeFacultyGraph('РАНХиГС', [
  makeCluster('public', 'Государство и управление', GRAPH_ACCENTS.society, [
    makeNode('ИПНБ', 'Институт права и национальной безопасности', { officialType: 'institute' }),
    makeNode('ВШГУ', 'Высшая школа государственного управления', { officialType: 'school' }),
  ]),
  makeCluster('society', 'Общество и право', GRAPH_ACCENTS.law, [
    makeNode('ИОН', 'Институт общественных наук', { officialType: 'institute' }),
    makeNode('Факультет права', 'Факультет права'),
  ]),
]);

const FINU_GRAPH = makeFacultyGraph('Финуниверситет', [
  makeCluster('finance', 'Финансы и экономика', GRAPH_ACCENTS.business, [
    makeNode('Экономика и финансы', 'Экономика и финансы'),
    makeNode('Менеджмент и маркетинг', 'Менеджмент и маркетинг'),
  ]),
  makeCluster('analytics', 'Аналитика и право', GRAPH_ACCENTS.tech, [
    makeNode('Математика и информатика', 'Математика и информатика'),
    makeNode('Философия, история и право', 'Философия, история и право'),
  ]),
]);

const NSU_GRAPH = makeFacultyGraph('НГУ', [
  makeCluster('tech', 'IT и робототехника', GRAPH_ACCENTS.tech, [
    makeNode('ФИТ', 'Факультет информационных технологий'),
    makeNode('ИИР', 'Институт интеллектуальной робототехники', { officialType: 'institute' }),
  ]),
  makeCluster('physmath', 'Физика и математика', GRAPH_ACCENTS.math, [
    makeNode('ММФ', 'Механико-математический факультет'),
    makeNode('ФФ', 'Физический факультет'),
  ]),
  makeCluster('science', 'Естественные науки', GRAPH_ACCENTS.science, [
    makeNode('ФЕН', 'Факультет естественных наук'),
    makeNode('ГГФ', 'Геолого-геофизический факультет'),
  ]),
  makeCluster('society', 'Общество и управление', GRAPH_ACCENTS.society, [
    makeNode('ГИ', 'Гуманитарный институт', { officialType: 'institute' }),
    makeNode('ИФП', 'Институт философии и права', { officialType: 'institute' }),
    makeNode('ЭФ', 'Экономический факультет'),
  ]),
  makeCluster('medicine', 'Медицина', GRAPH_ACCENTS.medicine, [
    makeNode('ИМиМТ', 'Институт медицины и медицинских технологий', { officialType: 'institute' }),
  ]),
]);

export const CAMPUSES = [
  // === РУК (Российский университет кооперации) ===
  {
    id: 'ruk_moscow',
    university: 'РУК',
    fullName: 'Российский университет кооперации',
    city: 'Москва',
    address: 'ул. Верхняя Красносельская, 11/5',
    short: 'РУК · Москва',
    logo: '/university-logos/ruk.png',
    faculties: getGraphFacultyValues(RUK_MOSCOW_GRAPH),
    facultyGraph: RUK_MOSCOW_GRAPH,
  },
  {
    id: 'ruk_mytishchi',
    university: 'РУК',
    fullName: 'Российский университет кооперации',
    city: 'Мытищи',
    address: 'ул. Веры Волошиной, 12/30',
    short: 'РУК · Мытищи',
    logo: '/university-logos/ruk.png',
    faculties: getGraphFacultyValues(RUK_MYTISHCHI_GRAPH),
    facultyGraph: RUK_MYTISHCHI_GRAPH,
  },

  // === МГУ ===
  {
    id: 'mgu_moscow',
    university: 'МГУ',
    fullName: 'Московский государственный университет',
    city: 'Москва',
    address: '',
    short: 'МГУ · Москва',
    logo: '/university-logos/msu.png',
    faculties: getGraphFacultyValues(MSU_GRAPH),
    facultyGraph: MSU_GRAPH,
  },

  // === ВШЭ ===
  {
    id: 'hse_moscow',
    university: 'ВШЭ',
    fullName: 'Высшая школа экономики',
    city: 'Москва',
    address: '',
    short: 'ВШЭ · Москва',
    logo: '/university-logos/hse.svg',
    faculties: getGraphFacultyValues(HSE_GRAPH),
    facultyGraph: HSE_GRAPH,
  },

  // === МГТУ ===
  {
    id: 'mgtu_moscow',
    university: 'МГТУ',
    fullName: 'МГТУ им. Баумана',
    city: 'Москва',
    address: '',
    short: 'МГТУ · Москва',
    logo: '/university-logos/bmstu.png',
    faculties: getGraphFacultyValues(BMSTU_GRAPH),
    facultyGraph: BMSTU_GRAPH,
  },

  // === РАНХиГС ===
  {
    id: 'ranepa_moscow',
    university: 'РАНХиГС',
    fullName: 'Российская академия народного хозяйства',
    city: 'Москва',
    address: '',
    short: 'РАНХиГС · Москва',
    logo: '/university-logos/ranepa.svg',
    faculties: getGraphFacultyValues(RANEPA_GRAPH),
    facultyGraph: RANEPA_GRAPH,
  },

  // === Финуниверситет ===
  {
    id: 'fa_krasnodar',
    university: 'Финуниверситет',
    fullName: 'Краснодарский филиал Финансового университета при Правительстве Российской Федерации',
    city: 'Краснодар',
    address: 'ул. Шоссе Нефтяников, 32',
    short: 'Финуниверситет · Краснодар',
    logo: '/university-logos/finuniversity-mark.svg',
    faculties: getGraphFacultyValues(FINU_GRAPH),
    facultyGraph: FINU_GRAPH,
  },

  // === НГУ ===
  {
    id: 'nsu_novosibirsk',
    university: 'НГУ',
    fullName: 'Новосибирский национальный исследовательский государственный университет',
    city: 'Новосибирск',
    address: '',
    short: 'НГУ · Новосибирск',
    logo: '/university-logos/nsu-mark.svg',
    faculties: getGraphFacultyValues(NSU_GRAPH),
    facultyGraph: NSU_GRAPH,
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
 * Найти узел графа подразделений по сохраненному значению.
 */
export const getFacultyGraphNode = (campus, value) => {
  if (!campus?.facultyGraph || !value) return null;

  const clusters = campus.facultyGraph.clusters || [];
  for (const cluster of clusters) {
    const node = (cluster.nodes || []).find(item => item.value === value);
    if (node) return { ...node, cluster: node.cluster || cluster.label };
  }

  const other = campus.facultyGraph.other;
  if (other?.value === value) return { ...other, cluster: other.cluster || 'Другое' };
  return null;
};

/**
 * Получить display-строку для кампуса
 * Пример: "РУК · Москва" или "КубГУ · Краснодар" (для custom)
 */
export const getCampusDisplayName = (user) => {
  if (user.campus_id) {
    const campus = getCampusById(user.campus_id);
    return campus ? campus.short : user.campus_id;
  }
  if (user.custom_university) {
    return user.custom_city 
      ? `${user.custom_university} · ${user.custom_city}`
      : user.custom_university;
  }
  return 'Не указано';
};

/**
 * Получить компактную строку для поверхностей с ограниченной шириной.
 * Пример: "Финуниверситет · Краснодар".
 */
export const getCampusCompactDisplayName = (user) => {
  if (!user) return '';

  if (user.campus_id) {
    const campus = getCampusById(user.campus_id);
    if (campus) return `${campus.university} · ${campus.city}`;
  }

  const university = (user.university || user.custom_university || '').trim();
  const city = (user.city || user.custom_city || '').trim();

  if (university && city) return `${university} · ${city}`;
  return university || '';
};

/**
 * Получить строку образования для карточек и модалок.
 */
export const getEducationDisplayName = (user, { includeInstitute = true, includeCourse = false } = {}) => {
  if (!user) return '';

  const parts = [getCampusCompactDisplayName(user)];
  if (includeInstitute && user.institute) parts.push(user.institute);
  if (includeCourse && user.course) parts.push(`${user.course} курс`);

  return parts.filter(Boolean).join(' • ');
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
      campus.short.toLowerCase().includes(q) ||
      (campus.faculties || []).some(faculty => faculty.toLowerCase().includes(q)) ||
      (campus.facultyGraph?.clusters || []).some(cluster =>
        cluster.label.toLowerCase().includes(q) ||
        (cluster.nodes || []).some(node =>
          node.value.toLowerCase().includes(q) ||
          node.label.toLowerCase().includes(q) ||
          node.fullName.toLowerCase().includes(q)
        )
      )
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
